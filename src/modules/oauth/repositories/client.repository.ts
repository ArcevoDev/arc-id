// src/modules/oauth/repositories/client.repository.ts
//
// FIX (Bug 7): tenantId: null default in findByClientId meant that when a caller
// passed no tenantId (or passed ctx.tenantId which is null for SYSTEM flows),
// the WHERE clause became { clientId, tenantId: null } — matching only clients
// that were explicitly created with tenantId = null (platform-level clients).
//
// Practical impact: every tenant-scoped OAuth client was invisible to the
// authorize/token-exchange flows when called from a SYSTEM-tenant context,
// returning 401 invalid_client for valid registrations.
//
// Fix strategy: when tenantId is provided, look for an exact tenant match OR
// a platform-level (tenantId = null) client with that clientId — platform
// clients are shared and should be accessible from any tenant context.
// When tenantId is null/undefined, fall back to clientId-only lookup so
// platform clients remain discoverable.
//
// This is intentionally permissive for platform clients (tenantId: null rows)
// because those represent first-party integrations that are valid across all
// tenants. Tenant-scoped clients are still isolated — a client registered for
// tenant A will not be returned when the caller is in tenant B.

import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors/api-error";

export class ClientRepository {
  constructor(private db: DbClient) {}

  async findByClientId(clientId: string, tenantId?: string | null) {
    if (tenantId) {
      // Prefer exact tenant match; fall back to platform-level client.
      return this.db.client.findFirst({
        where: {
          clientId,
          OR: [{ tenantId }, { tenantId: null }],
        },
        // Exact tenant match takes precedence if both exist
        orderBy: { tenantId: "desc" },
        include: { redirectUris: true },
      });
    }

    // No tenant context — match any client with this clientId.
    // Used by public flows (e.g. device auth, token introspection) where the
    // tenant is not yet known.
    return this.db.client.findFirst({
      where: { clientId },
      include: { redirectUris: true },
    });
  }

  async findByClientIdOrThrow(clientId: string, tenantId?: string | null) {
    const client = await this.findByClientId(clientId, tenantId);
    if (!client) throw ApiError.invalidClient();
    return client;
  }

  async validateRedirectUri(
    clientId: string,
    redirectUri: string,
  ): Promise<boolean> {
    const count = await this.db.clientRedirectUri.count({
      where: { clientId, uri: redirectUri },
    });
    return count > 0;
  }
}
