import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { TokenService } from "../services/token.service";
import { TokenRepository } from "../repositories/token.repository";
import { presentTokenResponse } from "../presenters/token.presenter";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";

const RefreshSchema = z.object({
  refresh_token: z.string(),
  client_id: z.string(),
  client_secret: z.string().optional(),
});

export const tokenRefreshFlow: Flow<z.infer<typeof RefreshSchema>> = {
  name: "oauth:token-refresh",
  inputSchema: RefreshSchema,

  async execute(input, ctx: FlowContext) {
    const tokenRepo = new TokenRepository(ctx.db);
    const tokenService = new TokenService();

    const existing = await tokenRepo.findActiveRefreshToken(
      input.refresh_token,
    );

    if (!existing) {
      // Token not found or already used — potential replay / theft
      // Revoke the entire session's token family
      const anyToken = await ctx.db.refreshToken.findFirst({
        where: { token: input.refresh_token },
      });
      if (anyToken?.sessionId) {
        await ctx.db.refreshToken.updateMany({
          where: { sessionId: anyToken.sessionId },
          data: { revoked: true },
        });
        await ctx.db.session.updateMany({
          where: { id: anyToken.sessionId },
          data: { valid: false },
        });
      }
      auditService.log({ action: "TOKEN_REVOKED", ip: ctx.ip });
      throw ApiError.invalidGrant(
        "Refresh token is invalid, expired, or already used",
      );
    }

    // Strict RTR: revoke old token before issuing new one
    await ctx.db.refreshToken.update({
      where: { id: existing.id },
      data: { revoked: true, rotatedAt: new Date() },
    });

    const bundle = await tokenService.issue(ctx, {
      identityId: existing.identityId,
      clientId: existing.clientId,
      sessionId: existing.sessionId ?? existing.id,
      scopes: [],
      audience: [existing.clientId],
      tenantId: ctx.tenantId,
    });

    return presentTokenResponse(bundle);
  },
};
