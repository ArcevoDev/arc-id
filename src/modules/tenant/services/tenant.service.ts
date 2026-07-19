import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors/api-error";

export class TenantService {
  constructor(private db: DbClient) {}

  async assertMembership(tenantId: string, identityId: string) {
    const membership = await this.db.tenantMembership.findFirst({
      where: { tenantId, identityId, status: "ACTIVE" },
    });

    if (!membership) throw ApiError.forbidden("Not a member of this tenant");

    return membership;
  }
}
