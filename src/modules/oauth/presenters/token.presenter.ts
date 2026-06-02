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
