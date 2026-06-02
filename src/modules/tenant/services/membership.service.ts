import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors/api-error";

export class MembershipService {
  constructor(private db: DbClient) {}

  async add(tenantId: string, identityId: string, roleName: string) {
    // Wrap in a transaction to prevent race conditions during the check-then-create flow
    return await this.db.$transaction(async (tx) => {
      const existing = await tx.tenantMembership.findFirst({
        where: { tenantId, identityId },
      });

      if (existing) {
        throw ApiError.conflict("Identity is already a member of this tenant");
      }

      const role = await tx.role.findFirst({
        where: {
          name: roleName,
          OR: [{ tenantId }],
        },
        orderBy: { tenantId: "desc" },
      });

      if (!role) {
        throw ApiError.notFound(`Role '${roleName}' not found for this tenant`);
      }

      return tx.tenantMembership.create({
        data: {
          tenantId,
          identityId,
          roleId: role.id,
          status: "ACTIVE",
        },
        include: { role: true },
      });
    });
  }

  async remove(tenantId: string, identityId: string): Promise<void> {
    const result = await this.db.tenantMembership.updateMany({
      where: { tenantId, identityId, status: "ACTIVE" },
      data: { status: "INACTIVE" },
    });

    if (result.count === 0) {
      throw ApiError.notFound("Active membership not found for this identity");
    }
  }
}
