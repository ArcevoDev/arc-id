// src/modules/oauth/flows/revoke-token-by-id.flow.ts
//
// Counterpart to token-revoke.flow.ts (RFC 7009, keyed by raw token value).
// This flow backs DELETE /oauth/tokens/:id — the UI-facing "Active Tokens"
// table can't display or transmit a raw token value, so it revokes by the
// AccessToken row's `id`, scoped to the authenticated caller.
//
// Reuses the same side effects as the access-token branch of
// token-revoke.flow.ts: mark revoked, block the jti in Redis for its
// remaining TTL, and record a revokedJti row for cleanup.

import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";
import { blockJti } from "@/lib/security/jti-blocklist";

export const RevokeTokenByIdSchema = z.object({
  id: z.string().cuid(),
});

export const revokeTokenByIdFlow: Flow<z.infer<typeof RevokeTokenByIdSchema>> =
  {
    name: "oauth:token-revoke-by-id",
    inputSchema: RevokeTokenByIdSchema,

    async execute(input, ctx: FlowContext) {
      if (!ctx.identityId) throw ApiError.unauthorized("Not logged in");

      // Ownership scoping: a caller can only revoke their own tokens.
      const accessToken = await ctx.db.accessToken.findFirst({
        where: { id: input.id, identityId: ctx.identityId },
        select: {
          id: true,
          jti: true,
          identityId: true,
          expiresAt: true,
          revoked: true,
        },
      });

      if (!accessToken) {
        throw ApiError.notFound("Token not found");
      }

      if (accessToken.revoked) {
        // Idempotent — already revoked, nothing to do.
        return {};
      }

      await ctx.db.accessToken.update({
        where: { id: accessToken.id },
        data: { revoked: true },
      });

      if (accessToken.jti) {
        const remainingTtlMs = accessToken.expiresAt.getTime() - Date.now();
        const remainingTtlSec = Math.max(Math.ceil(remainingTtlMs / 1000), 1);

        void blockJti(accessToken.jti, remainingTtlSec).catch(() => {});

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
          metadata: {
            reason: "user_revoked_active_token",
            tokenId: accessToken.id,
          },
        })
        .catch(() => {});

      return {};
    },
  };
