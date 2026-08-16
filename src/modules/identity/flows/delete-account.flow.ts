import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { notificationService } from "@/lib/notifications/notification.service";
import { blockJti } from "@/lib/security/jti-blocklist";

export const deleteAccountFlow: Flow<
  Record<string, never>,
  Record<string, never>
> = {
  name: "identity:delete-account",
  inputSchema: z.object({}),

  async execute(_input, ctx: FlowContext): Promise<Record<string, never>> {
    if (!ctx.identityId) throw ApiError.unauthorized("Authentication required");

    const identity = await ctx.db.identity.findUniqueOrThrow({
      where: { id: ctx.identityId },
      select: { primaryEmail: true, name: true },
    });

    // Collect live access tokens before revoking — we need their JTIs
    // to blocklist them in Redis and the revokedJti table. The auth guard
    // checks both, not accessToken.revoked, so this is not optional.
    const liveTokens = await ctx.db.accessToken.findMany({
      where: { identityId: ctx.identityId, revoked: false, jti: { not: null } },
      select: { jti: true, expiresAt: true },
    });

    await ctx.db.$transaction([
      ctx.db.identity.update({
        where: { id: ctx.identityId },
        data: { status: "DELETED" },
      }),
      ctx.db.session.updateMany({
        where: { identityId: ctx.identityId, valid: true },
        data: { valid: false },
      }),
      ctx.db.refreshToken.updateMany({
        where: { identityId: ctx.identityId, revoked: false },
        data: { revoked: true },
      }),
      ctx.db.accessToken.updateMany({
        where: { identityId: ctx.identityId, revoked: false },
        data: { revoked: true },
      }),
      ...liveTokens.map((t) =>
        ctx.db.revokedJti.create({
          data: { jti: t.jti!, expiresAt: t.expiresAt },
        }),
      ),
    ]);

    // Redis blocklist — non-blocking, runs outside the tx
    for (const t of liveTokens) {
      const remainingTtlMs = t.expiresAt.getTime() - Date.now();
      const remainingTtlSec = Math.max(Math.ceil(remainingTtlMs / 1000), 1);
      void blockJti(t.jti!, remainingTtlSec).catch(() => {});
    }

    await auditService.log({
      action: "IDENTITY_DELETED",
      identityId: ctx.identityId,
      ip: ctx.ip ?? "0.0.0.0",
    });

    if (identity.primaryEmail) {
      notificationService
        .sendAccountDeletion(identity.primaryEmail, {
          name: identity.name ?? undefined,
          graceDays: 30,
        })
        .catch((err) => {
          // Rearranged parameters to guarantee error and message logging compile safely
          ctx.logger?.error(
            "Deferred account deletion notification failed",
            err,
          );
        });
    }

    return {};
  },
};
