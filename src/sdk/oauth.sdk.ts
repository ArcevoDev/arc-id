import type { SdkClient } from "./client";

export function createOAuthSdk(client: SdkClient) {
  return {
    /**
     * GET /oauth/clients — list OAuth clients for your active tenant.
     */
    listClients: () => client.get<any[]>("/oauth/clients"),

    /**
     * POST /oauth/clients — register a new OAuth client.
     * Requires PRO plan + client:create permission.
     */
    createClient: (data: {
      name: string;
      redirectUris: string[];
      grantTypes?: ("authorization_code" | "refresh_token" | "client_credentials")[];
      scopes?: string[];
      public?: boolean;
      requirePkce?: boolean;
      tenantId?: string;
      projectId?: string;
    }) => client.post("/oauth/clients", data),

    /**
     * DELETE /oauth/clients/:clientId — delete an OAuth client.
     * Requires PRO plan + client:delete permission.
     */
    deleteClient: (clientId: string) =>
      client.delete(`/oauth/clients/${clientId}`),

    /**
     * GET /oauth/tokens — list the caller's active access tokens.
     */
    listTokens: () => client.get<any[]>("/oauth/tokens"),

    /**
     * DELETE /oauth/tokens/:id — revoke one of the caller's active tokens by DB row id.
     */
    revokeToken: (tokenId: string) =>
      client.delete(`/oauth/tokens/${tokenId}`),

    /**
     * POST /oauth/consent — grant OAuth consent scopes.
     */
    grantConsent: (data: { clientId: string; scopes: string[] }) =>
      client.post("/oauth/consent", data),

    /**
     * DELETE /oauth/consent/:clientId — revoke consent for a client.
     */
    revokeConsent: (clientId: string) =>
      client.delete(`/oauth/consent/${clientId}`),

    /**
     * GET /oauth/consents — list granted consents.
     */
    listConsents: () => client.get<any[]>("/oauth/consents"),

    /**
     * POST /oauth/introspect — RFC 7662 token introspection.
     */
    introspectToken: (token: string) =>
      client.post<any>("/oauth/introspect", { token }),

    /**
     * POST /oauth/revoke — RFC 7009 token revocation.
     */
    revokeTokenRFC7009: (token: string, tokenTypeHint?: string) =>
      client.post("/oauth/revoke", { token, token_type_hint: tokenTypeHint }),

    /**
     * GET /oauth/userinfo — OIDC UserInfo endpoint.
     */
    userinfo: () => client.get<any>("/oauth/userinfo"),

    /**
     * GET /oauth/jwks — RFC 7517 JWKS (global signing keys).
     */
    jwks: () => client.get<any>("/oauth/jwks"),
  };
}
