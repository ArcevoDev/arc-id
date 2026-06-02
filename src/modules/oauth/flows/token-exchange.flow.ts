import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { TokenExchangeSchema } from "../validators/oauth.schemas";
import { ClientRepository } from "../repositories/client.repository";
import { TokenService } from "../services/token.service";
import { verifyPkce } from "../services/pkce.service";
import { presentTokenResponse } from "../presenters/token.presenter";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";
import argon2 from "argon2";

export const tokenExchangeFlow: Flow<z.infer<typeof TokenExchangeSchema>> = {
  name: "oauth:token-exchange",
  inputSchema: TokenExchangeSchema,

  async execute(input, ctx: FlowContext) {
    const clientRepo = new ClientRepository(ctx.db);
    const tokenService = new TokenService();

    // ── Authorization Code ─────────────────────────────────────────────────
    if (input.grant_type === "authorization_code") {
      const authCode = await ctx.db.authorizationCode.findFirst({
        where: {
          code: input.code,
          consumed: false,
          expiresAt: { gt: new Date() },
        },
        include: { client: { include: { redirectUris: true } } },
      });
      if (!authCode)
        throw ApiError.invalidGrant("Authorization code is invalid or expired");

      // client_id must match
      if (authCode.client.clientId !== input.client_id) {
        throw ApiError.invalidClient("client_id mismatch");
      }

      // Verify redirect URI if provided
      if (input.redirect_uri) {
        const allowed = authCode.client.redirectUris.some(
          (r) => r.uri === input.redirect_uri,
        );
        if (!allowed)
          throw ApiError.invalidRequest(
            "redirect_uri does not match registered URIs",
          );
      }

      // Client secret check for confidential clients
      if (!authCode.client.public && authCode.client.clientSecret) {
        if (!input.client_secret)
          throw ApiError.invalidClient("client_secret required");
        const valid = await argon2.verify(
          authCode.client.clientSecret,
          input.client_secret,
        );
        if (!valid) throw ApiError.invalidClient("Invalid client_secret");
      }

      // PKCE
      if (authCode.codeChallenge) {
        if (!input.code_verifier)
          throw ApiError.invalidRequest("code_verifier required");
        const ok = verifyPkce(
          input.code_verifier,
          authCode.codeChallenge,
          authCode.codeChallengeMethod ?? "S256",
        );
        if (!ok) throw ApiError.invalidGrant("PKCE verification failed");
      }

      // Consume code (single use)
      await ctx.db.authorizationCode.update({
        where: { id: authCode.id },
        data: { consumed: true },
      });

      // Resolve or create session
      const session = await ctx.db.session.findFirst({
        where: { identityId: authCode.identityId, valid: true },
        orderBy: { createdAt: "desc" },
      });

      const sessionId = session?.id ?? authCode.identityId;

      const bundle = await tokenService.issue(ctx, {
        identityId: authCode.identityId,
        clientId: authCode.clientId,
        sessionId,
        scopes: authCode.scopes as string[],
        audience: [authCode.client.clientId],
        tenantId: ctx.tenantId,
        nonce: authCode.nonce ?? undefined,
      });

      auditService.log({
        action: "SESSION_CREATED",
        identityId: authCode.identityId,
        ip: ctx.ip,
      });

      return presentTokenResponse(bundle);
    }

    // ── Client Credentials ─────────────────────────────────────────────────
    if (input.grant_type === "client_credentials") {
      const client = await clientRepo.findByClientIdOrThrow(
        input.client_id,
        ctx.tenantId,
      );
      if (!client.clientSecret)
        throw ApiError.invalidClient(
          "Client does not support client_credentials",
        );

      const valid = await argon2.verify(
        client.clientSecret,
        input.client_secret,
      );
      if (!valid) throw ApiError.invalidClient("Invalid client_secret");

      const requestedScopes = input.scope
        ? input.scope.split(" ")
        : (client.scopes as string[]);

      const bundle = await tokenService.issue(ctx, {
        identityId: client.id,
        clientId: client.id,
        sessionId: client.id,
        scopes: requestedScopes,
        audience: [client.clientId],
        tenantId: ctx.tenantId,
      });

      return presentTokenResponse(bundle);
    }

    throw ApiError.unsupportedGrantType();
  },
};
