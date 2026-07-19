// src/modules/auth/services/session.service.ts
import { generateToken } from "@/lib/crypto";
import { addDays, addMinutes } from "date-fns";
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
  /**
   * Session TTL in minutes — derived from TenantPolicy.sessionTtlMinutes.
   * Falls back to the schema default (10080 = 7 days) when not provided.
   */
  sessionTtlMinutes?: number;
  /**
   * Maximum concurrent sessions per user — derived from
   * TenantPolicy.maxSessionsPerUser. When provided and the identity
   * already has this many valid sessions, the oldest session(s) are
   * evicted (set valid=false) before the new one is inserted.
   *
   * This is a deliberate evict-oldest choice (not a technical constraint):
   * blocking a new login because the user is already at their session cap
   * would be a terrible UX.  The user's current session is always the one
   * they most recently authenticated on — evicting the oldest inactive
   * session is the least surprising behaviour.
   */
  maxSessionsPerUser?: number;
}

export class SessionService {
  constructor(private readonly db: DbClient) {}

  /**
   * Provisions a session bound to an identity.
   * authLevel defaults to "aal1" (password login baseline).
   * Pass "aal2" when MFA or passkey has already been verified in the same
   * authentication ceremony (e.g. passkey-authenticate.flow, mfa-verify.flow).
   *
   * tenant-scoped TTL and max-session limits come from the caller — the
   * service has no knowledge of TenantPolicy.  The caller (login.flow.ts)
   * resolves the policy and passes sessionTtlMinutes/maxSessionsPerUser.
   */
  async create(input: CreateSessionInput) {
    const sessionToken = generateToken(64);
    const ttlMinutes = input.sessionTtlMinutes ?? 10080; // schema default
    const expiresAt = addMinutes(new Date(), ttlMinutes);

    // ── Enforce maxSessionsPerUser (evict oldest) ─────────────────────────
    // This runs BEFORE the insert so the new session never bumps the count
    // above cap temporarily.  Evict-oldest means the user's most recent
    // session (the one they're about to establish) is always the one that
    // survives.
    if (input.maxSessionsPerUser && input.maxSessionsPerUser > 0) {
      const activeCount = await this.db.session.count({
        where: {
          identityId: input.identityId,
          valid: true,
          expiresAt: { gt: new Date() },
        },
      });

      if (activeCount >= input.maxSessionsPerUser) {
        const excess = activeCount - input.maxSessionsPerUser + 1;
        // Fetch the oldest `excess` sessions by createdAt ASC
        const oldestSessions = await this.db.session.findMany({
          where: {
            identityId: input.identityId,
            valid: true,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "asc" },
          take: excess,
          select: { id: true },
        });

        if (oldestSessions.length > 0) {
          await this.db.session.updateMany({
            where: { id: { in: oldestSessions.map((s) => s.id) } },
            data: { valid: false },
          });
        }
      }
    }

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
