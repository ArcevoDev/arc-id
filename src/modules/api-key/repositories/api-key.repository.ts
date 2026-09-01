import type { DbClient } from "@/lib/db-client";

export class ApiKeyRepository {
  constructor(private db: DbClient) {}

  async findApiKey(hash: string) {
    return this.db.apiKey.findUnique({
      where: { keyHash: hash },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        status: true,
        tenantId: true,
        identityId: true,
        lastUsedAt: true,
      },
    });
  }

  async createApiKey(data: {
    tenantId: string;
    identityId: string;
    name: string;
    keyHash: string;
    keyPrefix: string;
    scopes: string[];
  }) {
    return this.db.apiKey.create({
      data: {
        tenantId: data.tenantId,
        identityId: data.identityId,
        name: data.name,
        keyHash: data.keyHash,
        keyPrefix: data.keyPrefix,
        scopes: data.scopes,
        status: "ACTIVE",
      },
      select: { id: true, keyPrefix: true, createdAt: true, scopes: true, name: true },
    });
  }

  async revokeApiKey(id: string, tenantId: string) {
    return this.db.apiKey.updateMany({
      where: { id, tenantId, status: "ACTIVE" },
      data: { status: "REVOKED" },
    });
  }

  async updateLastUsed(id: string) {
    return this.db.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async listApiKeys(identityId: string) {
    return this.db.apiKey.findMany({
      where: { identityId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        status: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
