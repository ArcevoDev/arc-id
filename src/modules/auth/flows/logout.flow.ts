// src/modules/auth/flows/logout.flow.ts
//
// FIX (two bugs found together):
//
// 1. accessJti was read off `(ctx as any).jti` — but logout.route.ts
//    never put a `jti` field on FlowContext, so this was always
//    undefined. In practice, logout only ever revoked the session and
//    refresh token; the access token's JTI was NEVER blocklisted, so a
//    still-valid access token kept working until its natural ~15min
//    expiry after every logout. accessJti/accessTokenExp now come in as
//    explicit flow input, sourced by the route from the verified JWT
//    payload (req.user.jti / req.user.exp) — not from the request body.
//
// 2. revokedJti.upsert's create was missing the required `expiresAt`
//    field (see token-revoke.flow.ts's identical fix) — Prisma would
//    throw on this write whenever accessJti WAS present. Combined with
//    bug #1 this was fully dormant (the branch never ran), but needed
//    fixing regardless now that #1 makes the branch reachable.
//
// 3. blockJti (the fast Redis-backed check) was never called here,
//    unlike every other revocation path (token-revoke, token-refresh,
//    revoke-token-by-id) — only the DB-backed revokedJti row was
//    written. Fixed to match the "always call both together" pattern.

import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { auditService } from "@/modules/audit/services/audit.service";
import { blockJti } from "@/lib/security/jti-blocklist";

const LogoutSchema = z.object({
  sessionId: z.string().min(40).max(128),
  // Sourced from the verified JWT by logout.route.ts, not client input.
  accessJti: z.string().optional(),
  accessTokenExp: z.number().optional(), // unix seconds, JWT "exp" claim
});

export const logoutFlow: Flow<
  z.infer<typeof LogoutSchema>,
  Record<string, never>
> = {
  name: "auth:logout",
  inputSchema: LogoutSchema,

  async execute(input, ctx: FlowContext): Promise<Record<string, never>> {
    const session = await ctx.db.session.findFirst({
      where: {
        id: input.sessionId,
        ...(ctx.identityId ? { identityId: ctx.identityId } : {}),
      },
      select: {
        id: true,
        identityId: true,
        refreshTokenId: true,
      },
    });

    if (!session) {
      void auditService
        .log({
          action: "SESSION_REVOKED",
          identityId: ctx.identityId,
          ip: ctx.ip,
          metadata: {
            reason: "session_not_found_on_logout",
            sessionId: input.sessionId,
          },
        })
        .catch(() => {});
      return {};
    }

    const accessJti = input.accessJti;
    const accessTokenExpiresAt = input.accessTokenExp
      ? new Date(input.accessTokenExp * 1000)
      : undefined;

    await (ctx.db as any).$transaction(async (tx: any) => {
      if (session.refreshTokenId) {
        await tx.refreshToken.updateMany({
          where: {
            id: session.refreshTokenId,
            revoked: false,
          },
          data: {
            revoked: true,
            rotatedAt: new Date(),
          },
        });
      }

      await tx.refreshToken.updateMany({
        where: {
          sessionId: session.id,
          revoked: false,
        },
        data: {
          revoked: true,
          rotatedAt: new Date(),
        },
      });

      await tx.session.update({
        where: { id: session.id },
        data: { valid: false },
      });

      if (accessJti && accessTokenExpiresAt) {
        await tx.revokedJti.upsert({
          where: { jti: accessJti },
          update: {},
          create: { jti: accessJti, expiresAt: accessTokenExpiresAt },
        });
      }
    });

    if (accessJti && accessTokenExpiresAt) {
      const remainingTtlMs = accessTokenExpiresAt.getTime() - Date.now();
      const remainingTtlSec = Math.max(Math.ceil(remainingTtlMs / 1000), 1);
      void blockJti(accessJti, remainingTtlSec).catch(() => {});
    }

    void auditService
      .log({
        action: "SESSION_REVOKED",
        identityId: session.identityId,
        ip: ctx.ip,
        metadata: {
          sessionId: session.id,
          accessTokenBlacklisted: Boolean(accessJti && accessTokenExpiresAt),
        },
      })
      .catch(() => {});

    return {};
  },
};
