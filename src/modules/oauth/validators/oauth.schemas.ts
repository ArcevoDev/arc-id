// src/modules/oauth/validators/oauth.schemas.ts
import { z } from "zod";

export const AuthorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  scope: z.string().optional().default("openid profile email"),
  state: z.string().optional(),
  nonce: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(["S256", "plain"]).optional(),

  // ── OIDC Core 1.0 §3.1.2.1 ───────────────────────────────────────────────
  //
  // prompt — controls whether the authorization server prompts the end-user
  //   for reauthentication or consent.
  //
  //   "none"          — do not display any auth/consent UI. Return
  //                     login_required or consent_required if interaction
  //                     is needed. Used for silent token renewal.
  //   "login"         — force re-authentication even if the user has a valid
  //                     session. Returns interaction_required if the server
  //                     cannot force this inline (which is our case for the
  //                     API flow — we redirect the client back to /login).
  //   "consent"       — force the consent screen even if the user already
  //                     granted consent. Useful when scopes change.
  //   "select_account"— ask the user to select an account. We treat this the
  //                     same as "login" since we don't support multi-account.
  //
  // max_age — maximum authentication age in seconds (RFC 6749 + OIDC Core §3.1.2.1).
  //   If the user's session is older than max_age seconds, the server MUST
  //   reauthenticate the user (or return interaction_required).
  //   A value of 0 means "must re-authenticate now" — equivalent to prompt=login.
  prompt: z.enum(["none", "login", "consent", "select_account"]).optional(),
  max_age: z.preprocess(
    (v) => (v !== undefined && v !== "" ? Number(v) : undefined),
    z.number().int().nonnegative().optional(),
  ),
});

export const TokenExchangeSchema = z.discriminatedUnion("grant_type", [
  z.object({
    grant_type: z.literal("authorization_code"),
    code: z.string(),
    redirect_uri: z.string().url(),
    client_id: z.string(),
    client_secret: z.string().optional(),
    code_verifier: z.string().optional(),
    state: z.string().optional(),
  }),
  z.object({
    grant_type: z.literal("refresh_token"),
    refresh_token: z.string(),
    client_id: z.string(),
    client_secret: z.string().optional(),
  }),
  z.object({
    grant_type: z.literal("client_credentials"),
    client_id: z.string(),
    client_secret: z.string(),
    scope: z.string().optional(),
  }),
]);

export const IntrospectSchema = z.object({
  token: z.string(),
  token_type_hint: z.enum(["access_token", "refresh_token"]).optional(),
});

export const RevokeSchema = z.object({
  token: z.string(),
  token_type_hint: z.enum(["access_token", "refresh_token"]).optional(),
});
