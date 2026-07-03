// src/modules/auth/services/email-token.service.ts
import type { DbClient } from "@/lib/db-client";
import type { TokenType } from "@/prisma-client";
import { generateToken } from "@/lib/crypto";
import { addHours } from "date-fns";
import { ApiError } from "@/core/errors/api-error";

export class EmailTokenService {
  constructor(private db: DbClient) {}

  /**
   * Issue a one-time-use email token.
   *
   * @param identityId  The identity this token is bound to.
   * @param type        TokenType enum value (VERIFY_EMAIL, RESET_PASSWORD, TENANT_INVITE, etc.)
   * @param ttlHours    How long until the token expires. Default: 1 hour.
   * @param tenantId    Optional. For TENANT_INVITE tokens: the tenant the invite is for.
   *                    Stored so invite.route.ts can activate the correct membership
   *                    when an identity has multiple simultaneous pending invites.
   */
  async issue(
    identityId: string,
    type: TokenType,
    ttlHours = 1,
    tenantId?: string,
  ): Promise<string> {
    // Invalidate any existing unused tokens of the same type (+ same tenant if provided)
    await this.db.emailToken.updateMany({
      where: {
        identityId,
        type,
        consumed: false,
        // For tenant invites, only invalidate tokens for the same tenant.
        // For other types, tenantId is null so this condition is always met.
        ...(tenantId ? { tenantId } : {}),
      },
      data: { consumed: true },
    });

    const token = generateToken(32);
    await this.db.emailToken.create({
      data: {
        identityId,
        type,
        token,
        expiresAt: addHours(new Date(), ttlHours),
        ...(tenantId ? { tenantId } : {}),
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
