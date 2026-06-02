import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors/api-error";

export class TokenRepository {
  constructor(private db: DbClient) {}

  async findActiveAccessToken(jti: string) {
    return this.db.accessToken.findFirst({
      where: { jti, revoked: false, expiresAt: { gt: new Date() } },
    });
  }

  async findActiveRefreshToken(token: string) {
    return this.db.refreshToken.findFirst({
      where: { token, revoked: false, expiresAt: { gt: new Date() } },
    });
  }

  async revokeTokenFamily(familyJti: string) {
    // Revoke all refresh tokens in the same family (theft detection)
    // Family is tracked via sessionId
    const token = await this.db.refreshToken.findFirst({
      where: { token: familyJti },
    });
    if (!token?.sessionId) return;

    await this.db.refreshToken.updateMany({
      where: { sessionId: token.sessionId },
      data: { revoked: true },
    });
  }
}
