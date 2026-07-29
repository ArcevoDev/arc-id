import type { SdkClient } from "./client";

export function createCredentialsSdk(client: SdkClient) {
  return {
    /** GET /credentials — list credentials held by the authenticated identity. */
    list: () => client.get<any[]>("/credentials"),

    /**
     * POST /credentials/verify — body expects { credential: <vc string> }
     */
    verify: (credential: string) =>
      client.post<any>("/credentials/verify", { credential }),

    /**
     * POST /credentials/issue — issue a new credential
     */
    issue: (data: Record<string, unknown>) =>
      client.post("/credentials/issue", data),

    /**
     * POST /credentials/offers — create a credential offer
     */
    offer: (data: Record<string, unknown>) =>
      client.post<{ token: string; expiresAt: string }>("/credentials/offers", data),

    /**
     * POST /credentials/revoke — revoke by credentialId (UUID) in the body
     */
    revoke: (credentialId: string) =>
      client.post("/credentials/revoke", { credentialId }),

    /**
     * POST /credentials/offers/:token/accept — accept a credential offer.
     */
    acceptOffer: (token: string) =>
      client.post(`/credentials/offers/${token}/accept`),

    /**
     * POST /credentials/verify/session — create a verification session.
     */
    createVerificationSession: (credentialRef?: string) =>
      client.post<any>("/credentials/verify/session", credentialRef ? { credentialRef } : undefined),

    /**
     * POST /credentials/verify/present — present a credential for verification.
     */
    presentForVerification: (data: { sessionId: string; credential: unknown; proof: unknown }) =>
      client.post("/credentials/verify/present", data),

    /**
     * GET /credentials/status-lists/:id — resolve a Bitstring Status List.
     */
    getStatusList: (id: string) =>
      client.get<any>(`/credentials/status-lists/${id}`),

    /**
     * GET /credentials/tenants/:slug/did.json — resolve a tenant's DID document.
     */
    resolveTenantDidDoc: (slug: string) =>
      client.get<any>(`/credentials/tenants/${slug}/did.json`),
  };
}
