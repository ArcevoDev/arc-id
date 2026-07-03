// src/modules/tenant/services/membership.service.ts
import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors";

const MEMBER_CAPS: Record<string, number> = {
  FREE: 3,
  PRO: 50,
  ENTERPRISE: Infinity,
};

export class MembershipService {
  constructor(private db: DbClient) {}

  async add(
    tenantId: string,
    identityId: string,
    roleName: string,
    callerPlan: string = "FREE",
  ) {
    return await ((this.db as any).$transaction(async (tx: any) => {
      const existing = await tx.tenantMembership.findFirst({
        where: { tenantId, identityId },
      });

      if (existing?.status === "ACTIVE") {
        throw ApiError.conflict(
          "Identity is already an active member of this tenant",
        );
      }

      if (!existing || existing.status !== "PENDING") {
        const cap = MEMBER_CAPS[callerPlan] ?? MEMBER_CAPS.FREE;
        if (cap !== Infinity) {
          const currentCount = await tx.tenantMembership.count({
            where: {
              tenantId,
              status: { in: ["ACTIVE", "PENDING"] },
            },
          });

          if (currentCount >= cap) {
            throw new ApiError(
              `Your ${callerPlan} plan allows up to ${cap} members. Upgrade your plan to invite more members.`,
              400,
              "MEMBER_CAP_REACHED",
            );
          }
        }
      }

      const role = await tx.role.findFirst({
        where: { name: roleName, OR: [{ tenantId }] },
        orderBy: { tenantId: "desc" },
      });

      if (!role) {
        throw ApiError.notFound(`Role '${roleName}' not found for this tenant`);
      }

      if (existing?.status === "PENDING") {
        return tx.tenantMembership.update({
          where: { id: existing.id },
          data: { roleId: role.id },
          include: { role: true },
        });
      }

      return tx.tenantMembership.create({
        data: {
          tenantId,
          identityId,
          roleId: role.id,
          status: "PENDING",
        },
        include: { role: true },
      });
    }) as Promise<any>);
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
