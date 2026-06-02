import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors/api-error";

export class CredentialRepository {
  constructor(private db: DbClient) {}

  async findByIdOrThrow(id: string) {
    const vc = await this.db.verifiableCredential.findUnique({
      where: { id },
      include: { issuer: true, subject: true, statusList: true },
    });
    if (!vc) throw ApiError.notFound("Credential not found");
    return vc;
  }

  async findByHolder(holderId: string) {
    return this.db.verifiableCredential.findMany({
      where: { holderId },
      include: { issuer: true },
    });
  }
}
