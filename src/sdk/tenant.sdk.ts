import type { SdkClient } from "./client";

export function createTenantSdk(client: SdkClient) {
  return {
    /**
     * ⚠️ No GET /tenants route exists on the backend.
     * The route at GET /tenants/:slug returns a single tenant by slug, not a list.
     * A "list tenants" endpoint has not been implemented.
     * This method is intentionally omitted — it would return 404.
     * If needed, implement GET /tenants route first.
     */

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
  };
}
