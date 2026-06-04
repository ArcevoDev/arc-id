// src/modules/oauth/flows/token-refresh.flow.ts
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

    const existing = await tokenRepo.findActiveRefreshToken(input.refresh_token);

    if (!existing) {
      // Token not found or already used — potential replay attack
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
      await auditService.log({ action: "TOKEN_REVOKED", ip: ctx.ip });
      throw ApiError.invalidGrant("Refresh token is invalid, expired, or already used");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FIX 1: RefreshToken.clientId stores Client.id (the cuid DB primary key),
    // NOT the Client.clientId (the human-readable string like "arcid-direct").
    // token.service.ts expects the clientId *string*, so we must resolve it.
    // ─────────────────────────────────────────────────────────────────────────
    const clientRecord = await ctx.db.client.findUnique({
      where: { id: existing.clientId },
      select: { clientId: true, scopes: true },
    });
    if (!clientRecord) {
      throw ApiError.invalidGrant("Client associated with this token no longer exists");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FIX 2: was passing scopes: [] — refreshed tokens had completely empty scope.
    // Carry forward scopes from the last access token issued for this session,
    // falling back to the client's registered default scopes.
    // ─────────────────────────────────────────────────────────────────────────
    const lastAccessToken = await ctx.db.accessToken.findFirst({
      where: {
        identityId: existing.identityId,
        clientId: existing.clientId,
        revoked: false,
      },
      orderBy: { issuedAt: "desc" },
      select: { scopes: true },
    });

    const scopes =
      (lastAccessToken?.scopes as string[] | null) ??
      (clientRecord.scopes as string[]) ??
      ["openid", "profile", "email", "offline_access"];

    // Strict RTR: revoke old token before issuing new one
    await ctx.db.refreshToken.update({
      where: { id: existing.id },
      data: { revoked: true, rotatedAt: new Date() },
    });

    const bundle = await tokenService.issue(ctx, {
      identityId: existing.identityId,
      clientId: clientRecord.clientId,      // ← FIXED: use clientId string
      sessionId: existing.sessionId ?? existing.id,
      scopes,                               // ← FIXED: carry forward real scopes
      audience: [clientRecord.clientId],    // ← FIXED: use clientId string
      tenantId: ctx.tenantId,
    });

    return presentTokenResponse(bundle);
  },
};