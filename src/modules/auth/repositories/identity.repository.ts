// src/modules/auth/repositories/identity.repository.ts
import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors/api-error";

export class IdentityRepository {
  constructor(private db: DbClient) {}

  async findForAuth(email: string) {
    return this.db.identity.findUnique({
      where: { primaryEmail: email },
      include: {
        localAccount: true,
        mfas: { where: { enabled: true } },
        memberships: {
          where: { status: "ACTIVE" },
          include: { role: true, tenant: true },
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

  async findByUsername(username: string) {
    return this.db.identity.findUnique({ where: { username } });
  }

  async isUsernameTaken(
    username: string,
    excludeIdentityId?: string,
  ): Promise<boolean> {
    const count = await this.db.identity.count({
      where: {
        username,
        ...(excludeIdentityId ? { id: { not: excludeIdentityId } } : {}),
      },
    });
    return count > 0;
  }

  /**
   * Sets username once. Relies on the DB unique index as the final guard
   * against a race between isUsernameTaken() and this write — that race is
   * real (two requests claiming the same name within the same millisecond)
   * and is exactly what the unique index exists to catch. Callers must
   * translate a Prisma P2002 error here into a 409, not a 500.
   */
  async setUsername(identityId: string, username: string) {
    return this.db.identity.update({
      where: { id: identityId },
      data: { username },
    });
  }
}
