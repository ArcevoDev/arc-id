// JWT utility wrappers — thin layer over @fastify/jwt
// The actual signing/verification is done via fastify.jwt
// injected by the jwt plugin. This module holds shared claim types.

export interface AccessTokenClaims {
  sub: string; // identityId
  jti: string; // unique token id
  aud: string[]; // audience (resource servers)
  scope: string; // space-separated scopes
  tid?: string; // tenantId
  // Authentication Assurance Level. "aal1" = single factor (password,
  // magic link, social/SSO). "aal2" = MFA or passkey completed.
  // Absent (not null) for non-human grants — e.g. client_credentials —
  // where assurance level doesn't apply because no end-user authenticated.
  aal?: "aal1" | "aal2";
}

export interface IdTokenClaims {
  sub: string;
  iss: string;
  aud: string;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  // See AccessTokenClaims.aal — same semantics. ID tokens are only ever
  // issued for human identities (openid scope), so in practice this is
  // always present when an ID token exists, but stays optional for safety.
  aal?: "aal1" | "aal2";
}

export interface RefreshTokenClaims {
  sub: string;
  jti: string;
  fam: string; // token family for RTR
}
