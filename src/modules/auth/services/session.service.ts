import type { PrismaClient } from "@/prisma-client";
import { generateToken } from "@/lib/crypto";
import { addDays } from "date-fns";

export interface CreateSessionInput {
  identityId: string;
  localAccountId?: string;
  ip?: string | null;
  userAgent?: string | null;
}

export class SessionService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Provisions a sovereign identity session bound securely to the core client context.
   * Decoupled completely from downstream TokenService token generation side effects.
   */
  async create(input: CreateSessionInput) {
    const sessionToken = generateToken(64);
    // Standard session window defaults to 7 operational days
    const expiresAt = addDays(new Date(), 7);

    const session = await this.db.session.create({
      data: {
        identityId: input.identityId,
        localAccountId: input.localAccountId || null,
        token: sessionToken,
        ip: input.ip || null,
        userAgent: input.userAgent || null,
        valid: true,
        expiresAt,
      },
    });

    return { session };
  }

  /**
   * Explicit check to determine if an active session profile context remains valid.
   */
  async validate(token: string) {
    const session = await this.db.session.findFirst({
      where: {
        token,
        valid: true,
        expiresAt: { gt: new Date() },
      },
      include: {
        identity: true,
      },
    });

    return session;
  }
}