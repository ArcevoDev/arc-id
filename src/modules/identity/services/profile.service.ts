import { Prisma } from "@prisma-client";

export class ProfileService {
  constructor(private db: any) {}

  async update(
    identityId: string,
    data: {
      name?: string;
      picture?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.db.identity.update({
      where: { id: identityId },
      data: {
        name: data.name,
        picture: data.picture,
        metadata: data.metadata
          ? (data.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }
}
