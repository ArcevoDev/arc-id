// JWT utility wrappers — thin layer over @fastify/jwt
// The actual signing/verification is done via fastify.jwt
// injected by the jwt plugin. This module holds shared claim types.

export interface AccessTokenClaims {
  sub: string; // identityId
  jti: string; // unique token id
  aud: string[]; // audience (resource servers)
  scope: string; // space-separated scopes
  tid?: string; // tenantId
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
}

export interface RefreshTokenClaims {
  sub: string;
  jti: string;
  fam: string; // token family for RTR
}
