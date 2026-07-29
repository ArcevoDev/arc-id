import type { SdkClient } from "./client";

export function createIdpSdk(client: SdkClient) {
  return {
    /**
     * GET /idp/connections — list IdP connections for the current tenant (ENTERPRISE).
     */
    listConnections: () => client.get<any[]>("/idp/connections"),

    /**
     * GET /idp/connections/:id — get a specific IdP connection.
     */
    getConnection: (id: string) => client.get<any>(`/idp/connections/${id}`),

    /**
     * POST /idp/connections — create a new SAML2/OIDC/OAUTH2 connection (ENTERPRISE).
     */
    createConnection: (data: {
      protocol: "SAML2" | "OIDC" | "OAUTH2";
      providerName: string;
      issuer?: string;
      entryPoint?: string;
      metadataUrl?: string;
      clientId?: string;
      clientSecret?: string;
      attributeMapping?: Record<string, string>;
      enabled?: boolean;
    }) => client.post("/idp/connections", data),

    /**
     * PATCH /idp/connections/:id — update an IdP connection.
     */
    updateConnection: (id: string, data: Partial<Record<string, unknown>>) =>
      client.patch(`/idp/connections/${id}`, data),

    /**
     * DELETE /idp/connections/:id — delete an IdP connection.
     */
    deleteConnection: (id: string) => client.delete(`/idp/connections/${id}`),
  };
}
