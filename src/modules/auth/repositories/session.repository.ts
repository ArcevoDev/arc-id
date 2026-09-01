// src/modules/auth/repositories/session.repository.ts
import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors";
import { blockJti } from "@/lib/security/jti-blocklist";

export class SessionRepository {
  constructor(private db: DbClient) {}

  async findValidById(id: string) {
    const session = await this.db.session.findFirst({
      where: { id, valid: true, expiresAt: { gt: new Date() } },
    });
    if (!session) throw ApiError.unauthorized("Session not found or expired");
    return session;
  }

  async revokeById(id: string) {
    return this.db.session.update({
      where: { id },
      data: { valid: false },
    });
  }

  /**
   * Revoke all sessions for an identity AND their bound refresh tokens.
   *
   * FIX (Bug 2): Previous implementation only set session.valid = false.
   * Refresh tokens linked to those sessions remained live for up to 7 days,
   * meaning an attacker who intercepted a refresh token after a password reset
   * could keep rotating it indefinitely.
   *
   * The session → refreshToken relationship:
   *   Session.refreshTokenId → RefreshToken.id  (the currently-bound token)
   *   RefreshToken.sessionId → Session.id       (back-reference)
   *
   * We revoke via the back-reference (RefreshToken.sessionId) rather than
   * Session.refreshTokenId to catch all tokens ever issued for the session,
   * not just the currently-bound one. This handles the edge case where a token
   * was rotated between the session read and the revoke.
   */
  async revokeAllForIdentity(identityId: string) {
    // 1. Get all active session IDs for this identity
    const sessions = await this.db.session.findMany({
      where: { identityId, valid: true },
      select: { id: true },
    });

    if (sessions.length === 0) return;

    const sessionIds = sessions.map((s) => s.id);

    // Collect live access tokens to blocklist their JTIs (auth guard checks
    // revokedJti table + Redis, NOT accessToken.revoked).
    const liveAccessTokens = await this.db.accessToken.findMany({
      where: { identityId, revoked: false, jti: { not: null } },
      select: { jti: true, expiresAt: true },
    });

    // 2. Atomically revoke sessions, refresh tokens, AND access tokens
    await this.db.$transaction([
      // Block every access token for this identity
      this.db.accessToken.updateMany({
        where: { identityId, revoked: false },
        data: { revoked: true },
      }),
      // Revoke all refresh tokens whose sessionId is in the set
      this.db.refreshToken.updateMany({
        where: { sessionId: { in: sessionIds }, revoked: false },
        data: { revoked: true, rotatedAt: new Date() },
      }),
      // Then invalidate the sessions themselves
      this.db.session.updateMany({
        where: { id: { in: sessionIds } },
        data: { valid: false },
      }),
      // Record revoked JTIs for DB-backed fallback (auth guard consults
      // this table when Redis is unavailable).
      ...liveAccessTokens.map((t) =>
        this.db.revokedJti.create({
          data: { jti: t.jti!, expiresAt: t.expiresAt },
        }),
      ),
    ]);

    // Redis blocklist — non-blocking, runs outside the tx
    for (const t of liveAccessTokens) {
      const remainingTtlMs = t.expiresAt.getTime() - Date.now();
      const remainingTtlSec = Math.max(Math.ceil(remainingTtlMs / 1000), 1);
      void blockJti(t.jti!, remainingTtlSec).catch(() => {});
    }
  }
}
