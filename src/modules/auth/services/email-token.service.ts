import type { DbClient } from "@/lib/db-client";
import type { TokenType } from "@/prisma-client";
import { generateToken } from "@/lib/crypto";
import { addHours } from "date-fns";
import { ApiError } from "@/core/errors/api-error";

export class EmailTokenService {
  constructor(private db: DbClient) {}

  async issue(
    identityId: string,
    type: TokenType,
    ttlHours = 1,
  ): Promise<string> {
    // Invalidate any existing unused tokens of the same type
    await this.db.emailToken.updateMany({
      where: { identityId, type, consumed: false },
      data: { consumed: true },
    });

    const token = generateToken(32);
    await this.db.emailToken.create({
      data: {
        identityId,
        type,
        token,
        expiresAt: addHours(new Date(), ttlHours),
      },
    });

    return token;
  }

  async consume(token: string, type: TokenType) {
    const record = await this.db.emailToken.findFirst({
      where: { token, type, consumed: false, expiresAt: { gt: new Date() } },
    });
    if (!record) throw ApiError.badRequest("Token is invalid or has expired");

    await this.db.emailToken.update({
      where: { id: record.id },
      data: { consumed: true },
    });

    return record;
  }
}
