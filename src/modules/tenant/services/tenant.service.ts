import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors/api-error";

export class TenantService {
  constructor(private db: DbClient) {}

  async assertMembership(
    tenantId: string,
    identityId: string,
    requiredRoleName?: string,
  ) {
    const membership = await this.db.tenantMembership.findFirst({
      where: { tenantId, identityId, status: "ACTIVE" },
      include: { role: true },
    });

    if (!membership) throw ApiError.forbidden("Not a member of this tenant");

    if (requiredRoleName && membership.role.name !== requiredRoleName) {
      // ADMIN can always pass any role check
      if (membership.role.name !== "ADMIN") {
        throw ApiError.forbidden("Insufficient tenant role");
      }
    }

    return membership;
  }
}
