// src/modules/oauth/flows/token-revoke.flow.ts
//
// FIX: revokedJti.create was missing the expiresAt field which is now
// required by the schema (added in the last migration). Without it,
// every token revocation would throw a Prisma validation error at runtime.
//
// expiresAt = accessToken.expiresAt — the exact moment the JWT would
// have expired anyway. Cleanup job uses this for precise purging.

import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { RevokeSchema } from "../validators/oauth.schemas";
import { auditService } from "@/modules/audit/services/audit.service";
import { blockJti } from "@/lib/security/jti-blocklist";

export const tokenRevokeFlow: Flow<z.infer<typeof RevokeSchema>> = {
  name: "oauth:token-revoke",
  inputSchema: RevokeSchema,

  async execute(input, ctx: FlowContext) {
    const ownerFilter = ctx.identityId ? { identityId: ctx.identityId } : {};

    // ── Access token path ─────────────────────────────────────────────────────
    const accessToken = await ctx.db.accessToken.findFirst({
      where: { token: input.token, ...ownerFilter },
      select: { id: true, jti: true, identityId: true, expiresAt: true },
    });

    if (accessToken) {
      await ctx.db.accessToken.update({
        where: { id: accessToken.id },
        data: { revoked: true },
      });

      if (accessToken.jti) {
        const remainingTtlMs = accessToken.expiresAt.getTime() - Date.now();
        const remainingTtlSec = Math.max(Math.ceil(remainingTtlMs / 1000), 1);

        void blockJti(accessToken.jti, remainingTtlSec).catch(() => {});

        // FIX: expiresAt now included — required by schema after last migration
        void ctx.db.revokedJti
          .create({
            data: {
              jti: accessToken.jti,
              expiresAt: accessToken.expiresAt,
            },
          })
          .catch(() => {});
      }

      void auditService
        .log({
          action: "TOKEN_REVOKED",
          identityId: accessToken.identityId,
          ip: ctx.ip,
        })
        .catch(() => {});

      return {};
    }

    // ── Refresh token path ────────────────────────────────────────────────────
    const refreshToken = await ctx.db.refreshToken.findFirst({
      where: { token: input.token, ...ownerFilter },
      select: { id: true, identityId: true },
    });

    if (refreshToken) {
      await ctx.db.refreshToken.update({
        where: { id: refreshToken.id },
        data: { revoked: true },
      });

      void auditService
        .log({
          action: "TOKEN_REVOKED",
          identityId: refreshToken.identityId,
          ip: ctx.ip,
        })
        .catch(() => {});
    }

    return {};
  },
};
