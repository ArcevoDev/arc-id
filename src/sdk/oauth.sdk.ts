// src/sdk/oauth.sdk.ts
import { sdk } from "./client";

export const oauthSdk = {
  listClients: () => sdk.get<any[]>("/api/v1/oauth/clients"),
  createClient: (data: any) => sdk.post<any>("/api/v1/oauth/clients", data),
  updateClient: (id: string, data: any) =>
    sdk.patch<any>(`/api/v1/oauth/clients/${id}`, data),
  deleteClient: (id: string) => sdk.delete<void>(`/api/v1/oauth/clients/${id}`),
  listConsents: () => sdk.get<any[]>("/api/v1/oauth/consents"),
  revokeConsent: (id: string) =>
    sdk.delete<void>(`/api/v1/oauth/consents/${id}`),

  // RFC 7009 — revoke by raw token value. Used for confidential-client /
  // direct-token-handling flows. NOT used by the Active Tokens UI table,
  // since the UI never has (and shouldn't display) a raw token value.
  revokeToken: (token: string) =>
    sdk.post<void>("/api/v1/oauth/revoke", { token }),

  // Active Tokens page — list the caller's active access tokens.
  // Each row's `id` is what <ActiveTokenRow onRevoke> passes to revokeTokenById.
  listTokens: () => sdk.get<any[]>("/api/v1/oauth/tokens"),

  // Revoke one of the caller's own active access tokens by id.
  revokeTokenById: (id: string) =>
    sdk.delete<void>(`/api/v1/oauth/tokens/${id}`),
};
