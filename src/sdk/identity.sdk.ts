import type { SdkClient } from "./client";

export function createIdentitySdk(client: SdkClient) {
  return {
    list: (params?: { search?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set("search", params.search);
      if (params?.status) qs.set("status", params.status);
      const q = qs.toString();
      return client.get<any[]>(`/identity/admin${q ? `?${q}` : ""}`);
    },
    suspend: (id: string, reason?: string) =>
      client.post(`/identity/admin/${id}/suspend`, { reason }),
    reinstate: (id: string, reason?: string) =>
      client.patch(`/identity/${id}/status`, reason ? { status: "ACTIVE", reason } : { status: "ACTIVE" }),

    /** PATCH /identity/profile — update profile name, picture, metadata */
    updateProfile: (data: { name?: string; displayName?: string; picture?: string; metadata?: Record<string, unknown> }) =>
      client.patch("/identity/profile", data),

    /** DELETE /identity/profile — delete account (requires elevated session) */
    deleteAccount: () => client.delete("/identity/profile"),

    /** GET /identity/devices — list trusted devices */
    listDevices: () => client.get<any[]>("/identity/devices"),

    /** DELETE /identity/devices/:id — revoke a device */
    deleteDevice: (id: string) => client.delete(`/identity/devices/${id}`),

    /** GET /identity/linked-accounts — list linked OAuth provider accounts */
    listLinkedAccounts: () => client.get<any[]>("/identity/linked-accounts"),

    /** DELETE /identity/linked-accounts/:id — unlink an OAuth provider */
    unlinkLinkedAccount: (id: string) => client.delete(`/identity/linked-accounts/${id}`),

    /** GET /identity/external-ids — list linked external IDs */
    listExternalIds: () => client.get<any[]>("/identity/external-ids"),

    /** POST /identity/external-ids — link an external ID */
    linkExternalId: (data: { provider: string; externalId: string }) =>
      client.post("/identity/external-ids", data),

    /** DELETE /identity/external-ids/:id — unlink an external ID */
    unlinkExternalId: (id: string) => client.delete(`/identity/external-ids/${id}`),

    /** GET /identity/delegations — list delegations (currently returns 501) */
    listDelegations: () => client.get<any[]>("/identity/delegations"),

    /** POST /identity/delegations — create a delegation (currently returns 501) */
    createDelegation: (data: Record<string, unknown>) =>
      client.post("/identity/delegations", data),

    /** DELETE /identity/delegations/:id — revoke a delegation (currently returns 501) */
    revokeDelegation: (id: string) =>
      client.delete(`/identity/delegations/${id}`),

    /** POST /identity/onboarding/start — start or resume onboarding */
    startOnboarding: (flowId: string) =>
      client.post("/identity/onboarding/start", { flowId }),

    /** GET /identity/onboarding/:progressId — get onboarding progress */
    getOnboardingProgress: (progressId: string) =>
      client.get<any>(`/identity/onboarding/${progressId}`),

    /** POST /identity/onboarding/:progressId/advance — advance onboarding step */
    advanceOnboarding: (progressId: string, stepId: string, data?: Record<string, unknown>) =>
      client.post(`/identity/onboarding/${progressId}/advance`, { stepId, ...data }),

    /** POST /identity/wallet/did — register a wallet did:key */
    registerWalletDid: (data: { publicKeyJwk: Record<string, unknown>; provider: string; providerWalletId: string }) =>
      client.post("/identity/wallet/did", data),
  };
}
