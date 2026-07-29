import type { SdkClient } from "./client";

export function createTenantSdk(client: SdkClient) {
  return {
    /**
     * GET /tenants — list all organisations the current user belongs to.
     * Returns enriched tenant data with the user's role.
     */
    list: () => client.get<any[]>("/tenants"),

    /**
     * GET /tenants/:slug — fetch tenant by slug (requires ACTIVE membership).
     */
    get: (slug: string) => client.get<any>(`/tenants/${slug}`),

    /**
     * POST /tenants — create a new tenant.
     */
    create: (data: { name: string; slug: string }) =>
      client.post("/tenants", data),

    /**
     * POST /auth/switch-context — switch active tenant context.
     * Body: { tenantId: string } (cuid).
     * Returns a new token pair scoped to the target tenant.
     *
     * Lives in tenant.sdk.ts for API ergonomics despite the underlying
     * endpoint being under the /auth prefix.
     */
    switchTenant: (tenantId: string) =>
      client.post<{ accessToken: string; refreshToken: string; idToken: string | null; expiresIn: number }>(
        "/auth/switch-context",
        { tenantId },
      ),

    /**
     * GET /tenants/:tenantId/members — list members of a tenant.
     */
    listMembers: (tenantId: string) =>
      client.get<any[]>(`/tenants/${tenantId}/members`),

    /**
     * POST /tenants/:tenantId/members — add a member to a tenant.
     */
    addMember: (tenantId: string, data: { identityId: string; roleId: string }) =>
      client.post(`/tenants/${tenantId}/members`, data),

    /**
     * DELETE /tenants/:tenantId/members/:identityId — remove a member.
     */
    removeMember: (tenantId: string, identityId: string) =>
      client.delete(`/tenants/${tenantId}/members/${identityId}`),

    /**
     * GET /tenants/:tenantId/policy — get tenant policy.
     */
    getPolicy: (tenantId: string) =>
      client.get<any>(`/tenants/${tenantId}/policy`),

    /**
     * PATCH /tenants/:tenantId/policy — update tenant policy.
     */
    updatePolicy: (tenantId: string, data: Record<string, unknown>) =>
      client.patch(`/tenants/${tenantId}/policy`, data),

    /**
     * POST /tenants/invites/accept — accept an invitation token.
     */
    acceptInvite: (data: { token: string }) =>
      client.post("/tenants/invites/accept", data),

    /**
     * GET /tenants/:tenantId/did — get the tenant's DID document.
     */
    getDid: (tenantId: string) =>
      client.get<any>(`/tenants/${tenantId}/did`),

    /**
     * POST /tenants/:tenantId/did — provision a DID for the tenant.
     * Requires { domain: string } body — the domain to anchor the did:web to.
     */
    provisionDid: (tenantId: string, data: { domain: string }) =>
      client.post(`/tenants/${tenantId}/did`, data),

    /**
     * GET /tenants/:tenantId/signing-keys — list signing keys.
     */
    listSigningKeys: (tenantId: string) =>
      client.get<any[]>(`/tenants/${tenantId}/signing-keys`),

    /**
     * DELETE /tenants/:tenantId/signing-keys/:kid — revoke a signing key.
     */
    revokeSigningKey: (tenantId: string, kid: string) =>
      client.delete(`/tenants/${tenantId}/signing-keys/${kid}`),

    /**
     * GET /tenants/:tenantId/projects — list projects for a tenant.
     */
    listProjects: (tenantId: string) =>
      client.get<any[]>(`/tenants/${tenantId}/projects`),

    /**
     * POST /tenants/:tenantId/projects — create a project under a tenant.
     */
    createProject: (tenantId: string, data: { name: string; description?: string }) =>
      client.post(`/tenants/${tenantId}/projects`, data),

    /**
     * GET /tenants/:tenantId/projects/:projectId — get a single project.
     */
    getProject: (tenantId: string, projectId: string) =>
      client.get<any>(`/tenants/${tenantId}/projects/${projectId}`),

    /**
     * PATCH /tenants/:tenantId/projects/:projectId — update a project.
     */
    updateProject: (tenantId: string, projectId: string, data: { name?: string; description?: string }) =>
      client.patch(`/tenants/${tenantId}/projects/${projectId}`, data),

    /**
     * DELETE /tenants/:tenantId/projects/:projectId — delete a project.
     */
    deleteProject: (tenantId: string, projectId: string) =>
      client.delete(`/tenants/${tenantId}/projects/${projectId}`),

    /**
     * POST /tenants/:tenantId/projects/:projectId/onboarding-flows — create an onboarding flow.
     */
    createOnboardingFlow: (tenantId: string, projectId: string, data: Record<string, unknown>) =>
      client.post(`/tenants/${tenantId}/projects/${projectId}/onboarding-flows`, data),

    /**
     * GET /tenants/:tenantId/projects/:projectId/onboarding-flows — list onboarding flows.
     */
    listOnboardingFlows: (tenantId: string, projectId: string) =>
      client.get<any[]>(`/tenants/${tenantId}/projects/${projectId}/onboarding-flows`),

    /**
     * GET /tenants/:tenantId/projects/:projectId/onboarding-flows/:flowId — get one onboarding flow.
     */
    getOnboardingFlow: (tenantId: string, projectId: string, flowId: string) =>
      client.get<any>(`/tenants/${tenantId}/projects/${projectId}/onboarding-flows/${flowId}`),

    /**
     * PATCH /tenants/:tenantId/projects/:projectId/onboarding-flows/:flowId — update an onboarding flow.
     */
    updateOnboardingFlow: (tenantId: string, projectId: string, flowId: string, data: Record<string, unknown>) =>
      client.patch(`/tenants/${tenantId}/projects/${projectId}/onboarding-flows/${flowId}`, data),

    /**
     * DELETE /tenants/:tenantId/projects/:projectId/onboarding-flows/:flowId — delete an onboarding flow.
     */
    deleteOnboardingFlow: (tenantId: string, projectId: string, flowId: string) =>
      client.delete(`/tenants/${tenantId}/projects/${projectId}/onboarding-flows/${flowId}`),

    /**
     * POST /tenants/:tenantId/signing-keys — create a new signing key.
     */
    createSigningKey: (tenantId: string, data: Record<string, unknown>) =>
      client.post(`/tenants/${tenantId}/signing-keys`, data),

    /**
     * GET /tenants/:slug/jwks — get tenant public JWKS by slug.
     */
    getJwksBySlug: (slug: string) =>
      client.get<any>(`/tenants/${slug}/jwks`),
  };
}
