interface TokenBundlePresenterInput {
  accessToken: string;
  refreshToken: string;
  idToken: string | null;
  expiresIn: number;
}

/** Formats token response per RFC 6749 §5.1 */
export function presentTokenResponse(bundle: TokenBundlePresenterInput) {
  return {
    access_token: bundle.accessToken,
    token_type: "Bearer",
    expires_in: bundle.expiresIn,
    refresh_token: bundle.refreshToken,
    ...(bundle.idToken ? { id_token: bundle.idToken } : {}),
  };
}

// ── Active token list view ──────────────────────────────────────────────────
// Used by GET /oauth/tokens. Deliberately omits the raw `token` value — the
// row's `id` is what <ActiveTokenRow onRevoke> uses, paired with
// DELETE /oauth/tokens/:id (see revoke-token-by-id.flow.ts). This is the
// counterpart to oauthSdk.revokeToken(token: string), which remains for
// RFC 7009-style confidential-client revocation and is unrelated to this UI path.
interface ActiveTokenPresenterInput {
  id: string;
  client: { name: string };
  scopes: unknown;
  issuedAt: Date;
  expiresAt: Date;
  revoked: boolean;
}

export function presentActiveToken(token: ActiveTokenPresenterInput) {
  return {
    id: token.id,
    clientName: token.client.name,
    scopes: Array.isArray(token.scopes) ? (token.scopes as string[]) : [],
    issuedAt: token.issuedAt,
    expiresAt: token.expiresAt,
    revoked: token.revoked,
  };
}
