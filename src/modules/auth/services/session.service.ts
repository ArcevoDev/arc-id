import type { DbClient } from "@/lib/db-client";
import type { Session } from "@/prisma-client";
import { generateToken } from "@/lib/crypto";
import { addDays, addMinutes } from "date-fns";

interface CreateSessionParams {
  identityId: string;
  localAccountId?: string;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
  tenantId?: string | null;
}

interface SessionBundle {
  session: Session;
  refreshTokenValue: string;
}

/**
 * Creates a new Session and its corresponding RefreshToken atomically.
 * Must be called within a transaction (ctx.db is a tx client).
 */
export class SessionService {
  constructor(private db: DbClient) {}

  async create(params: CreateSessionParams): Promise<SessionBundle> {
    const sessionTtlDays = 30;
    const refreshTokenValue = generateToken(48);

    const session = await this.db.session.create({
      data: {
        identityId: params.identityId,
        localAccountId: params.localAccountId,
        deviceId: params.deviceId,
        ip: params.ip,
        userAgent: params.userAgent,
        expiresAt: addDays(new Date(), sessionTtlDays),
        valid: true,
      },
    });

    return { session, refreshTokenValue };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db.session.update({
      where: { id: sessionId },
      data: { valid: false },
    });
  }
}
