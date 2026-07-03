// src/modules/oauth/flows/token-exchange.flow.ts
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
      if (authCode.client.clientId !== input.client_id)
        throw ApiError.invalidClient("client_id mismatch");

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

      // ── PKCE ──────────────────────────────────────────────────────────────
      if (authCode.client.requirePkce && !authCode.codeChallenge) {
        // Defense-in-depth: this should be impossible if /authorize's gate
        // worked correctly, but the exchange step shouldn't silently trust
        // that nothing upstream ever issues a challenge-less code for a
        // PKCE-required client. If this ever fires, treat it as a bug to
        // investigate (how did a code get issued without a challenge?),
        // not just a rejected request.
        throw ApiError.invalidGrant(
          "PKCE is required for this client but no code_challenge was recorded",
        );
      }
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

      // ── State CSRF validation (RFC 6749 §10.12) ──────────────────────────
      // The `state` stored at authorization time is compared against the
      // `state` the client sends at token exchange. If the client sent a
      // state at /authorize but sends none (or a different one) here, the
      // request is rejected — it indicates a CSRF or code-injection attack.
      //
      // Clients that sent no state at /authorize are not required to send
      // one here (state is optional per spec). The check only fires when
      // state was stored.
      if (authCode.state !== null && authCode.state !== undefined) {
        if (input.state !== authCode.state) {
          throw ApiError.invalidRequest(
            "state mismatch — the value sent at token exchange must match the value sent at authorization",
          );
        }
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
        select: { id: true, authLevel: true },
      });

      // FIX: previously fell back to authCode.identityId when no session
      // exists, silently treating an identity ID as a session ID. Anything
      // downstream that expects sessionId to resolve to a real Session row
      // (the step-up guard, logout.flow.ts's lookup) would break on this.
      // There should always be a session by the time an authorization code
      // is exchanged (the user had to log in to approve the authorize
      // request) — if there genuinely isn't one, that's a real inconsistency
      // worth surfacing rather than papering over with a fabricated id.
      if (!session) {
        throw ApiError.invalidGrant(
          "No active session found for this identity — please log in again",
        );
      }
      const sessionId = session.id;

      const bundle = await tokenService.issue(ctx, {
        identityId: authCode.identityId,
        clientId: authCode.clientId,
        sessionId,
        scopes: authCode.scopes as string[],
        audience: [authCode.client.clientId],
        tenantId: ctx.tenantId,
        nonce: authCode.nonce ?? undefined,
        authLevel: (session.authLevel as "aal1" | "aal2" | null) ?? "aal1",
      });

      void auditService
        .log({
          action: "SESSION_CREATED",
          identityId: authCode.identityId,
          ip: ctx.ip,
        })
        .catch(() => {});

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

      const disallowedScopes = requestedScopes.filter((s) =>
        ["openid", "offline_access"].includes(s),
      );
      if (disallowedScopes.length > 0) {
        throw ApiError.invalidScope(
          `client_credentials does not support: ${disallowedScopes.join(", ")}`,
        );
      }

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
