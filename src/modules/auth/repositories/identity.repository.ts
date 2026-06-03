// src/modules/auth/repositories/identity.repository.ts
import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors/api-error";

export class IdentityRepository {
  constructor(private db: DbClient) {}

  /**
   * Loads full authentication profiles including active roles per workspace partition context.
   */
  async findForAuth(email: string) {
    return this.db.identity.findUnique({
      where: { primaryEmail: email },
      include: {
        localAccount: true,
        mfas: { where: { enabled: true } },
        memberships: { 
          where: { status: "ACTIVE" }, 
          include: { role: true, tenant: true } 
        },
      },
    });
  }

  async findByIdOrThrow(id: string) {
    const identity = await this.db.identity.findUnique({
      where: { id },
      include: { localAccount: true },
    });
    if (!identity) throw ApiError.notFound("Identity not found");
    return identity;
  }

  async findByEmail(email: string) {
    return this.db.identity.findUnique({ where: { primaryEmail: email } });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.db.identity.count({
      where: { primaryEmail: email },
    });
    return count > 0;
  }
}