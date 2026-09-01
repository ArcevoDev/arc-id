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
}
