// src/modules/auth/flows/switch-context.flow.ts
//
// FIX (Bug 5): Removed the redundant "step 5" refresh token binding.
//
// The previous implementation did this after tokenService.issue():
//
//   const newRefreshTokenRecord = await ctx.db.refreshToken.findFirst({
//     where: { identityId: ctx.identityId, sessionId: session.id, revoked: false },
//     orderBy: { issuedAt: "desc" },
//     select: { id: true },
//   });
//   if (newRefreshTokenRecord) {
//     await ctx.db.session.update({
//       where: { id: session.id },
//       data: { refreshTokenId: newRefreshTokenRecord.id },
//     });
//   }
//
// token.service.ts already performs this exact write as part of issuing the
// token pair — it creates the RefreshToken record and immediately binds it
// to the session via session.update({ refreshTokenId: refreshRecord.id }).
//
// The explicit step 5 was therefore:
//   1. A read-after-write (unnecessary DB round trip)
//   2. A race window: between tokenService.issue() completing its .then()
//      write and this findFirst running, another concurrent request could
//      have issued and bound a newer token. The step-5 update would then
//      clobber the newer binding with a stale ID.
//
// Fix: simply remove step 5. token.service handles the binding atomically
// as part of its own write sequence.

import { z } from "zod";
import type { FlowContext, Flow } from "@/core/flows";
import { ApiError } from "@/core/errors/api-error";
import { TokenService } from "@/modules/oauth/services/token.service";
import { auditService } from "@/modules/audit/services/audit.service";
import { config } from "@/core/config";
import { SwitchContextSchema } from "../validators/auth.schemas";

type Output = {
  accessToken: string;
  refreshToken: string;
  idToken: string | null;
  expiresIn: number;
};

export const switchContextFlow: Flow<
  z.infer<typeof SwitchContextSchema>,
  Output
> = {
  name: "auth:switch-context",
  inputSchema: SwitchContextSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    if (!ctx.identityId) throw ApiError.unauthorized("Not logged in");

    // ── 1. Verify membership in the target tenant ─────────────────────────────
    const membership = await ctx.db.tenantMembership.findFirst({
      where: {
        identityId: ctx.identityId,
        tenantId: input.tenantId,
        status: "ACTIVE",
      },
      include: { role: { select: { name: true } } },
    });
    if (!membership) throw ApiError.forbidden("No access to this tenant");

    // ── 2. Resolve the active session ─────────────────────────────────────────
    const sessionId =
      ctx.sessionId ?? (ctx.metadata?.sessionId as string | undefined);
    if (!sessionId) throw ApiError.unauthorized("No active session found");

    const session = await ctx.db.session.findFirst({
      where: {
        id: sessionId,
        identityId: ctx.identityId,
        valid: true,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, refreshTokenId: true, authLevel: true },
    });
    if (!session) throw ApiError.unauthorized("Session not found or expired");

    // ── 3. Atomically revoke the session's current refresh token ──────────────
    // Conditional WHERE revoked = false makes this idempotent and race-safe.
    // If count = 0, a concurrent request already rotated this token — abort.
    if (session.refreshTokenId) {
      const { count: revokedCount } = await ctx.db.refreshToken.updateMany({
        where: { id: session.refreshTokenId, revoked: false },
        data: { revoked: true, rotatedAt: new Date() },
      });

      if (revokedCount === 0) {
        void auditService
          .log({
            action: "TOKEN_REVOKED",
            identityId: ctx.identityId,
            ip: ctx.ip,
            metadata: {
              reason: "context_switch_race_detected",
              sessionId,
              targetTenantId: input.tenantId,
            },
          })
          .catch(() => {});

        throw ApiError.conflict(
          "Context switch failed — concurrent session mutation detected. Please log in again.",
        );
      }
    }

    // ── 4. Issue the new tenant-scoped token pair ─────────────────────────────
    // token.service.ts creates the RefreshToken record AND binds it to the
    // session (session.update({ refreshTokenId })) as part of its write sequence.
    // No separate binding step needed here.
    const tokenService = new TokenService();
    const bundle = await tokenService.issue(ctx, {
      identityId: ctx.identityId,
      clientId: config.oauth.directClientId,
      sessionId: session.id,
      tenantId: input.tenantId,
      scopes: ["openid", "profile", "email", "offline_access"],
      audience: [config.oauth.directClientId],
      authLevel: (session.authLevel as "aal1" | "aal2" | null) ?? "aal1",
    });

    // Step 5 (the redundant findFirst + update) has been removed.
    // token.service handles session.refreshTokenId binding atomically.

    void auditService
      .log({
        action: "SESSION_CREATED",
        identityId: ctx.identityId,
        tenantId: input.tenantId,
        ip: ctx.ip,
        metadata: {
          event: "context_switch",
          fromTenantId: ctx.tenantId,
          toTenantId: input.tenantId,
          role: membership.role.name,
        },
      })
      .catch(() => {});

    return bundle;
  },
};
