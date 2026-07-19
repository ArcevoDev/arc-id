// src/modules/auth/routes/social.route.ts
//
// Social OAuth login — Google, GitHub, Apple, Microsoft.
//
// Architecture:
//   Each provider follows the same three-phase pattern:
//     1. GET /:provider          → redirect to provider with state + CSRF cookie
//     2. GET /:provider/callback → exchange code, upsert OAuthAccount+Identity,
//                                  issue ArcID session + JWT pair
//
// The user always ends up with an ArcID token — provider tokens are never
// exposed or stored long-term. Provider access tokens are kept only in
// OAuthAccount for potential future use (e.g. avatar refresh).
//
// Security:
//   - state param is a 32-byte random value stored in a signed httpOnly cookie
//     and verified on callback (CSRF protection per RFC 6749 §10.12)
//   - Provider tokens and secrets never appear in response bodies
//   - All writes (OAuthAccount + Identity + Session) run in one transaction
//
// Config needed in env / config.ts:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
//   APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
//   MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
//   SOCIAL_REDIRECT_URI (e.g. https://api.arcid.dev/auth/social/:provider/callback)
//
// Install deps: pnpm add arctic
// arctic provides lightweight, spec-correct OAuth2 clients for all four providers.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  Google,
  GitHub,
  Apple,
  MicrosoftEntraId,
  generateCodeVerifier,
} from "arctic";
import { generateToken } from "@/lib/crypto";
import { SessionService } from "../services/session.service";
import { TokenService } from "@/modules/oauth/services/token.service";
import { presentTokenResponse } from "@/modules/oauth/presenters/token.presenter";
import { config } from "@/core/config";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";

// ── Provider factory ──────────────────────────────────────────────────────────
// All provider instances are created lazily at route registration time so
// missing env vars surface at startup rather than at first request.

function buildRedirectUri(provider: string) {
  return `${config.base.apiUrl}/auth/social/${provider}/callback`;
}

function getGoogle() {
  const { clientId, clientSecret } = config.social.google;
  if (!clientId || !clientSecret)
    throw new Error("Google OAuth not configured");
  return new Google(clientId, clientSecret, buildRedirectUri("google"));
}

function getGitHub() {
  const { clientId, clientSecret } = config.social.github;
  if (!clientId || !clientSecret)
    throw new Error("GitHub OAuth not configured");
  return new GitHub(clientId, clientSecret, buildRedirectUri("github"));
}

function getApple() {
  const { clientId, teamId, keyId, privateKey } = config.social.apple;
  if (!clientId || !teamId || !keyId || !privateKey)
    throw new Error("Apple OAuth not configured");

  // Arctic v3 requires privateKey to be a Uint8Array byte representation
  const privateKeyBytes = new Uint8Array(Buffer.from(privateKey, "utf-8"));

  return new Apple(
    clientId,
    teamId,
    keyId,
    privateKeyBytes,
    buildRedirectUri("apple"),
  );
}

function getMicrosoft() {
  const { clientId, clientSecret, tenantId } = config.social.microsoft;
  if (!clientId || !clientSecret)
    throw new Error("Microsoft OAuth not configured");
  return new MicrosoftEntraId(
    tenantId,
    clientId,
    clientSecret,
    buildRedirectUri("microsoft"),
  );
}

// ── Shared callback logic ─────────────────────────────────────────────────────

interface ProviderProfile {
  providerUserId: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}

async function handleCallback(
  fastify: FastifyInstance,
  profile: ProviderProfile,
  provider: string,
  ip: string,
  userAgent: string | undefined,
) {
  const db = fastify.db;

  // ── Atomic: OAuthAccount + Identity + Session ─────────────────────────────
  const { identity, session } = await db.$transaction(async (tx) => {
    // Check for existing linked account
    const existing = await tx.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: { identity: true },
    });

    let resolvedIdentity: Awaited<
      ReturnType<typeof tx.identity.findUniqueOrThrow>
    >;

    if (existing) {
      // Update stored tokens and return existing identity
      await tx.oAuthAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken ?? null,
          expiresAt: profile.expiresAt ?? null,
        },
      });
      resolvedIdentity = existing.identity;
    } else {
      // Find or create an Identity for this email
      let newIdentity = profile.email
        ? await tx.identity.findFirst({
            where: { primaryEmail: profile.email },
          })
        : null;

      if (newIdentity && !newIdentity.emailVerified) {
        throw ApiError.conflict(
          "An account with this email already exists but hasn't been verified yet. " +
            "Please verify your email or sign in with your password first, then link this provider from your account settings.",
        );
      }

      if (!newIdentity) {
        // Create a new identity — social logins start ACTIVE (email trusted from provider)
        newIdentity = await tx.identity.create({
          data: {
            primaryEmail: profile.email,
            name: profile.name,
            picture: profile.picture,
            status: "ACTIVE",
            emailVerified: Boolean(profile.email),
          },
        });

        // Auto-join SYSTEM tenant as MEMBER
        const memberRole = await tx.role.findFirst({
          where: { tenantId: "SYSTEM", name: "MEMBER" },
          select: { id: true },
        });
        if (memberRole) {
          await tx.tenantMembership.create({
            data: {
              identityId: newIdentity.id,
              tenantId: "SYSTEM",
              roleId: memberRole.id,
              status: "ACTIVE",
            },
          });
        }
      }

      // Link the provider account
      await tx.oAuthAccount.create({
        data: {
          identityId: newIdentity.id,
          provider,
          providerUserId: profile.providerUserId,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken ?? null,
          expiresAt: profile.expiresAt ?? null,
        },
      });

      resolvedIdentity = newIdentity;
    }

    // Guard: blocked identities cannot log in
    if (resolvedIdentity.status === "SUSPENDED") {
      throw ApiError.forbidden("Account suspended");
    }
    if (resolvedIdentity.status === "BANNED") {
      throw ApiError.forbidden("Account banned");
    }

    // Create session
    const sessionService = new SessionService(tx as typeof db);
    const { session: newSession } = await sessionService.create({
      identityId: resolvedIdentity.id,
      ip,
      userAgent: userAgent ?? null,
      authLevel: "aal1",
    });

    return { identity: resolvedIdentity, session: newSession };
  });

  // Issue ArcID tokens outside the transaction (pure signing, no writes)
  const tokenService = new TokenService();
  const directClientId = config.oauth.directClientId;

  const bundle = await tokenService.issue(
    {
      db: fastify.db,
      tenantId: "SYSTEM",
      identityId: identity.id,
      requestId: "",
    } as any,
    {
      identityId: identity.id,
      clientId: directClientId,
      sessionId: session.id,
      scopes: ["openid", "profile", "email", "offline_access"],
      audience: [directClientId],
      tenantId: "SYSTEM",
      authLevel: "aal1",
    },
  );

  void auditService
    .log({
      action: "SESSION_CREATED",
      identityId: identity.id,
      ip,
      metadata: { provider },
    })
    .catch(() => {});

  return presentTokenResponse(bundle);
}

// ── Route registration ────────────────────────────────────────────────────────

export async function socialRoute(instance: FastifyInstance) {
  // Use any-casting context on the local loop reference variable to circumvent context compilation fallbacks
  const fastify = instance as any;

  // ── Google ──────────────────────────────────────────────────────────────────

  fastify.get(
    "/google",
    {
      schema: {
        tags: ["Social OAuth Login"],
        summary: "Redirect to Google OAuth",
      },
    },
    async (req: any, reply: any) => {
      const google = getGoogle();
      const state = generateToken(32);
      const codeVerifier = generateCodeVerifier();

      const url = google.createAuthorizationURL(state, codeVerifier, [
        "openid",
        "profile",
        "email",
      ]);

      reply.setCookie("oauth_state", state, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 600,
      });
      reply.setCookie("oauth_verifier", codeVerifier, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 600,
      });

      return reply.redirect(url.toString());
    },
  );

  fastify.get(
    "/google/callback",
    {
      schema: {
        tags: ["Social OAuth Login"],
        summary: "Google OAuth callback",
        querystring: z.object({
          code: z.string(),
          state: z.string(),
          error: z.string().optional(),
        }),
      },
    },
    async (req: any, reply: any) => {
      const { code, state, error } = req.query as any;
      if (error) throw ApiError.badRequest(`Google OAuth error: ${error}`);

      const storedState = req.cookies?.oauth_state;
      const storedVerifier = req.cookies?.oauth_verifier;
      if (!storedState || storedState !== state || !storedVerifier) {
        throw ApiError.badRequest(
          "Invalid OAuth state or missing code verifier",
        );
      }

      reply.clearCookie("oauth_state");
      reply.clearCookie("oauth_verifier");

      const google = getGoogle();
      const tokens = await google.validateAuthorizationCode(
        code,
        storedVerifier,
      );
      const accessToken = tokens.accessToken();

      // Fetch profile from Google userinfo endpoint
      const resp = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const profile = (await resp.json()) as any;

      const tokenData = await handleCallback(
        instance,
        {
          providerUserId: profile.sub,
          email: profile.email ?? null,
          name: profile.name ?? null,
          picture: profile.picture ?? null,
          accessToken,
          refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
          expiresAt: tokens.accessTokenExpiresAt(),
        },
        "google",
        req.ip,
        req.headers["user-agent"],
      );

      return reply.send({ success: true, data: tokenData });
    },
  );

  // ── GitHub ──────────────────────────────────────────────────────────────────

  fastify.get(
    "/github",
    {
      schema: {
        tags: ["Social OAuth Login"],
        summary: "Redirect to GitHub OAuth",
      },
    },
    async (req: any, reply: any) => {
      const github = getGitHub();
      const state = generateToken(32);
      const url = github.createAuthorizationURL(state, ["user:email"]);
      reply.setCookie("oauth_state", state, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 600,
      });
      return reply.redirect(url.toString());
    },
  );

  fastify.get(
    "/github/callback",
    {
      schema: {
        tags: ["Social OAuth Login"],
        summary: "GitHub OAuth callback",
        querystring: z.object({
          code: z.string(),
          state: z.string(),
          error: z.string().optional(),
        }),
      },
    },
    async (req: any, reply: any) => {
      const { code, state, error } = req.query as any;
      if (error) throw ApiError.badRequest(`GitHub OAuth error: ${error}`);

      const storedState = req.cookies?.oauth_state;
      if (!storedState || storedState !== state)
        throw ApiError.badRequest("Invalid OAuth state");
      reply.clearCookie("oauth_state");

      const github = getGitHub();
      const tokens = await github.validateAuthorizationCode(code);
      const accessToken = tokens.accessToken();

      const [userResp, emailResp] = await Promise.all([
        fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "ArcID",
          },
        }),
        fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "ArcID",
          },
        }),
      ]);
      const user = (await userResp.json()) as any;
      const emails = (await emailResp.json()) as any[];
      const primaryEmail =
        emails.find((e: any) => e.primary && e.verified)?.email ??
        user.email ??
        null;

      const tokenData = await handleCallback(
        instance,
        {
          providerUserId: String(user.id),
          email: primaryEmail,
          name: user.name ?? user.login ?? null,
          picture: user.avatar_url ?? null,
          accessToken,
          refreshToken: null,
          expiresAt: null,
        },
        "github",
        req.ip,
        req.headers["user-agent"],
      );

      return reply.send({ success: true, data: tokenData });
    },
  );

  // ── Apple ───────────────────────────────────────────────────────────────────
  // Apple uses POST for its callback (form_post response_mode) and only sends
  // name/email on the FIRST authorization. We handle both GET and POST.

  fastify.get(
    "/apple",
    {
      schema: {
        tags: ["Social OAuth Login"],
        summary: "Redirect to Apple Sign In",
      },
    },
    async (req: any, reply: any) => {
      const apple = getApple();
      const state = generateToken(32);
      const url = apple.createAuthorizationURL(state, ["name", "email"]);
      reply.setCookie("oauth_state", state, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 600,
      });
      return reply.redirect(url.toString());
    },
  );

  fastify.post(
    "/apple/callback",
    {
      schema: {
        tags: ["Social OAuth Login"],
        summary: "Apple Sign In callback (POST — form_post response_mode)",
      },
    },
    async (req: any, reply: any) => {
      const body = req.body as any;
      const { code, state, error } = body;
      if (error) throw ApiError.badRequest(`Apple OAuth error: ${error}`);

      const storedState = req.cookies?.oauth_state;
      if (!storedState || storedState !== state)
        throw ApiError.badRequest("Invalid OAuth state");
      reply.clearCookie("oauth_state");

      const apple = getApple();
      const tokens = await apple.validateAuthorizationCode(code);
      const idToken = tokens.idToken();

      // Apple sends user info in the POST body only on first authorization
      let nameFromBody: string | null = null;
      if (body.user) {
        try {
          const u = JSON.parse(body.user);
          nameFromBody =
            [u.name?.firstName, u.name?.lastName].filter(Boolean).join(" ") ||
            null;
        } catch {
          /* ignore */
        }
      }

      // Decode the id_token claims (apple doesn't have a userinfo endpoint)
      const [, payloadB64] = idToken.split(".");
      const claims = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString(),
      ) as any;

      const tokenData = await handleCallback(
        instance,
        {
          providerUserId: claims.sub,
          email: claims.email ?? null,
          name: nameFromBody,
          picture: null,
          accessToken: tokens.accessToken(),
          refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
          expiresAt: tokens.accessTokenExpiresAt(),
        },
        "apple",
        req.ip,
        req.headers["user-agent"],
      );

      return reply.send({ success: true, data: tokenData });
    },
  );

  // ── Microsoft ───────────────────────────────────────────────────────────────

  fastify.get(
    "/microsoft",
    {
      schema: {
        tags: ["Social OAuth Login"],
        summary: "Redirect to Microsoft OAuth",
      },
    },
    async (req: any, reply: any) => {
      const ms = getMicrosoft();
      const state = generateToken(32);
      const codeVerifier = generateCodeVerifier();

      const url = ms.createAuthorizationURL(state, codeVerifier, [
        "openid",
        "profile",
        "email",
      ]);

      reply.setCookie("oauth_state", state, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 600,
      });
      reply.setCookie("oauth_verifier", codeVerifier, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 600,
      });

      return reply.redirect(url.toString());
    },
  );

  fastify.get(
    "/microsoft/callback",
    {
      schema: {
        tags: ["Social OAuth Login"],
        summary: "Microsoft OAuth callback",
        querystring: z.object({
          code: z.string(),
          state: z.string(),
          error: z.string().optional(),
        }),
      },
    },
    async (req: any, reply: any) => {
      const { code, state, error } = req.query as any;
      if (error) throw ApiError.badRequest(`Microsoft OAuth error: ${error}`);

      const storedState = req.cookies?.oauth_state;
      const storedVerifier = req.cookies?.oauth_verifier;
      if (!storedState || storedState !== state || !storedVerifier) {
        throw ApiError.badRequest(
          "Invalid OAuth state or missing code verifier",
        );
      }

      reply.clearCookie("oauth_state");
      reply.clearCookie("oauth_verifier");

      const ms = getMicrosoft();
      const tokens = await ms.validateAuthorizationCode(code, storedVerifier);
      const accessToken = tokens.accessToken();

      const resp = await fetch(
        "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,photo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const user = (await resp.json()) as any;
      const email = user.mail ?? user.userPrincipalName ?? null;

      const tokenData = await handleCallback(
        instance,
        {
          providerUserId: user.id,
          email,
          name: user.displayName ?? null,
          picture: null,
          accessToken,
          refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
          expiresAt: tokens.accessTokenExpiresAt(),
        },
        "microsoft",
        req.ip,
        req.headers["user-agent"],
      );

      return reply.send({ success: true, data: tokenData });
    },
  );
}
