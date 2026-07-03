// src/modules/oauth/flows/authorize.flow.ts
import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { AuthorizeQuerySchema } from "../validators/oauth.schemas";
import { ClientRepository } from "../repositories/client.repository";
import { ConsentService } from "../services/consent.service";
import { generateToken } from "@/lib/crypto";
import { ApiError } from "@/core/errors/api-error";
import { addMinutes } from "date-fns";

// ── prompt / max_age error codes (OIDC Core 1.0 §3.1.2.6) ───────────────────
//
// These are returned as structured API errors. The client (SPA or native app)
// is responsible for acting on them — typically by redirecting the user to
// /auth/login or /auth/step-up.
//
// error codes that must appear in the redirect_uri per spec:
//   login_required      — user is not authenticated (prompt=none)
//   consent_required    — consent needed but prompt=none prevents prompting
//   interaction_required — re-auth or consent needed (prompt=login / max_age)
//
// In our API-first architecture we surface these as HTTP 400 with a
// machine-readable `error` field so the frontend can handle them gracefully.

export const authorizeFlow: Flow<z.infer<typeof AuthorizeQuerySchema>> = {
  name: "oauth:authorize",
  inputSchema: AuthorizeQuerySchema,

  async execute(input, ctx: FlowContext) {
    if (!ctx.identityId)
      throw ApiError.unauthorized("Must be authenticated to authorize");

    const clientRepo = new ClientRepository(ctx.db);
    const consentService = new ConsentService(ctx.db);

    const client = await clientRepo.findByClientIdOrThrow(
      input.client_id,
      ctx.tenantId,
    );

    const uriValid = await clientRepo.validateRedirectUri(
      client.id,
      input.redirect_uri,
    );
    if (!uriValid)
      throw ApiError.invalidRequest(
        "redirect_uri is not registered for this client",
      );

    // ── PKCE mandatory enforcement ──────────────────────────────────────────
    if (client.requirePkce && !input.code_challenge) {
      throw ApiError.invalidRequest(
        "code_challenge is required for this client (PKCE is mandatory)",
      );
    }

    // ── prompt=none shortcut ────────────────────────────────────────────────
    // prompt=none means "do not show any UI". Since the user IS authenticated
    // here (behind requireUser), we only need to check consent. If consent
    // is missing and we can't prompt, return consent_required immediately.
    const isPromptNone = input.prompt === "none";

    // ── max_age + prompt=login → check session freshness ────────────────────
    //
    // Both max_age=0/N and prompt=login require checking when the user last
    // authenticated. We look up the most recent valid session for this identity.
    //
    // If the session is too old (or prompt=login demands fresh auth), we
    // return interaction_required. The client must redirect the user to
    // /auth/login (or /auth/step-up for step-up flows) and then retry
    // /oauth/authorize after a fresh login.
    const needsFreshnessCheck =
      input.prompt === "login" ||
      input.prompt === "select_account" ||
      input.max_age !== undefined;

    if (needsFreshnessCheck) {
      const session = await ctx.db.session.findFirst({
        where: {
          identityId: ctx.identityId,
          valid: true,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, authLevel: true },
      });

      const needsReauth = (() => {
        // prompt=login always demands re-auth
        if (input.prompt === "login" || input.prompt === "select_account") {
          return true;
        }

        // max_age: check session age
        if (input.max_age !== undefined && session) {
          const sessionAgeSecs =
            (Date.now() - session.createdAt.getTime()) / 1000;
          return sessionAgeSecs > input.max_age;
        }

        // max_age=0 means "must have just authenticated" — no session is fine
        if (input.max_age === 0) return true;

        return false;
      })();

      if (needsReauth) {
        if (isPromptNone) {
          // Can't interact — spec says return login_required
          throw Object.assign(
            ApiError.badRequest(
              "User must re-authenticate — prompt=none prevents this",
            ),
            { code: "login_required" },
          );
        }
        // Tell the client to send the user back to /auth/login
        throw Object.assign(
          ApiError.badRequest(
            "Session is too old or prompt=login was requested — user must re-authenticate",
          ),
          { code: "interaction_required" },
        );
      }
    }

    // ── Scope resolution ────────────────────────────────────────────────────
    const rawScope = (input as any).scope as string | undefined;
    const requestedScopes = rawScope
      ? rawScope.split(" ")
      : (client.scopes as string[]);

    // ── Consent check ───────────────────────────────────────────────────────
    // prompt=consent forces the consent screen regardless of existing grants.
    const forceConsent = input.prompt === "consent";
    const hasConsent = forceConsent
      ? false // treat as no consent to force the consent flow
      : await consentService.hasConsent(
          ctx.identityId,
          client.id,
          requestedScopes,
        );

    if (!hasConsent) {
      if (isPromptNone) {
        // Can't show consent UI with prompt=none
        throw Object.assign(
          ApiError.badRequest("Consent required — prompt=none prevents this"),
          { code: "consent_required" },
        );
      }
      // Return consent_required signal — frontend shows the consent screen
      return {
        consentRequired: true,
        clientName: client.name,
        scopes: requestedScopes,
      };
    }

    // ── Issue authorization code ────────────────────────────────────────────
    const code = generateToken(32);
    await ctx.db.authorizationCode.create({
      data: {
        code,
        clientId: client.id,
        identityId: ctx.identityId,
        redirectUri: input.redirect_uri,
        scopes: requestedScopes,
        nonce: input.nonce,
        state: input.state,
        codeChallenge: input.code_challenge,
        codeChallengeMethod: input.code_challenge_method,
        expiresAt: addMinutes(new Date(), 5),
      },
    });

    return { code, state: input.state, consentRequired: false };
  },
};
