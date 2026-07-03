// src/modules/auth/services/session.service.ts
import { generateToken } from "@/lib/crypto";
import { addDays } from "date-fns";
import type { DbClient } from "@/lib/db-client";

// Auth Assurance Levels — written on every session so guards have a
// reliable signal without additional DB reads.
//
//   aal1  — password-only authentication (baseline)
//   aal2  — MFA or passkey completed (strong second factor)
//
// NULL on legacy sessions is treated as "aal1" by all guards.
export type AuthLevel = "aal1" | "aal2";

export interface CreateSessionInput {
  identityId: string;
  localAccountId?: string;
  ip?: string | null;
  userAgent?: string | null;
  // Caller sets the level at creation time so it is always persisted atomically
  // with the session row — no second UPDATE needed.
  authLevel?: AuthLevel;
}

export class SessionService {
  constructor(private readonly db: DbClient) {}

  /**
   * Provisions a session bound to an identity.
   * authLevel defaults to "aal1" (password login baseline).
   * Pass "aal2" when MFA or passkey has already been verified in the same
   * authentication ceremony (e.g. passkey-authenticate.flow, mfa-verify.flow).
   */
  async create(input: CreateSessionInput) {
    const sessionToken = generateToken(64);
    const expiresAt = addDays(new Date(), 7);

    const session = await this.db.session.create({
      data: {
        id: sessionToken,
        identityId: input.identityId,
        localAccountId: input.localAccountId || null,
        ip: input.ip || null,
        userAgent: input.userAgent || null,
        valid: true,
        expiresAt,
        authLevel: input.authLevel ?? "aal1",
      },
    });

    return { session };
  }

  /**
   * Elevates an existing session to "aal2" and stamps elevatedAt.
   * Called by step-up.service after re-authentication succeeds.
   */
  async elevate(sessionId: string): Promise<void> {
    await this.db.session.update({
      where: { id: sessionId },
      data: {
        authLevel: "aal2",
        elevatedAt: new Date(),
      },
    });
  }

  /**
   * Sets authLevel on an existing session without touching elevatedAt.
   * Used by mfa-verify.flow to promote the pending session after TOTP check.
   */
  async promoteToAal2(sessionId: string): Promise<void> {
    await this.db.session.update({
      where: { id: sessionId },
      data: { authLevel: "aal2" },
    });
  }

  /**
   * Returns true when the session is valid and unexpired.
   */
  async validate(token: string) {
    return this.db.session.findFirst({
      where: {
        id: token,
        valid: true,
        expiresAt: { gt: new Date() },
      },
      include: { identity: true },
    });
  }
}
