// src/modules/auth/repositories/session.repository.ts
import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors/api-error";

export class SessionRepository {
  constructor(private db: DbClient) {}

  async findValidById(id: string) {
    const session = await this.db.session.findFirst({
      where: { id, valid: true, expiresAt: { gt: new Date() } },
    });
    if (!session) throw ApiError.unauthorized("Session not found or expired");
    return session;
  }

  async revokeById(id: string) {
    return this.db.session.update({
      where: { id },
      data: { valid: false },
    });
  }

  async revokeAllForIdentity(identityId: string) {
    return this.db.session.updateMany({
      where: { identityId, valid: true },
      data: { valid: false },
    });
  }
}