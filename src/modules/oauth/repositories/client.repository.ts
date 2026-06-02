import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors/api-error";

export class ClientRepository {
  constructor(private db: DbClient) {}

  async findByClientId(clientId: string, tenantId?: string | null) {
    return this.db.client.findFirst({
      where: { clientId, tenantId: tenantId ?? null },
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
