import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors/api-error";

export class ProfileService {
  constructor(private db: DbClient) {}

  async update(
    identityId: string,
    data: { name?: string; picture?: string; metadata?: unknown },
  ) {
    return this.db.identity.update({
      where: { id: identityId },
      data: {
        name: data.name,
        picture: data.picture,
        metadata: data.metadata as any,
      },
    });
  }
}
