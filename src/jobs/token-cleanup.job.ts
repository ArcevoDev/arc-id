// src/jobs/token-cleanup.job.ts
//
// CHANGE: RevokedJti cleanup now uses expiresAt < NOW() instead of
// revokedAt < cutoff (7-day window). JTI rows are now deleted as soon
// as their parent access token has expired — much more precise and keeps
// the table small.
//
// All other cleanup logic (advisory lock, access/refresh token purge,
// session cleanup) is unchanged.

import { prisma } from "@/core/db";
import { Prisma } from "@/prisma-client";
import { logger } from "@/lib/logger";
import { subDays } from "date-fns";

const RETAIN_DAYS = 7;
const ADVISORY_LOCK_KEY = 1952807019;

export interface TokenCleanupResult {
  skipped: boolean;
  deleted: number;
  breakdown?: {
    accessTokens: number;
    refreshTokens: number;
    revokedJtis: number;
    expiredSessions: number;
  };
}

export async function runTokenCleanup(): Promise<TokenCleanupResult> {
  return prisma.$transaction(async (tx) => {
    const [lockRow] = await tx.$queryRaw<[{ acquired: boolean }]>(
      Prisma.sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS acquired`,
    );

    if (!lockRow.acquired) {
      logger.info(
        { lockKey: ADVISORY_LOCK_KEY },
        "[TOKEN_CLEANUP] Skipped — another instance holds the advisory lock",
      );
      return { skipped: true, deleted: 0 };
    }

    logger.info(
      { lockKey: ADVISORY_LOCK_KEY },
      "[TOKEN_CLEANUP] Acquired advisory lock — running cleanup",
    );

    const cutoff = subDays(new Date(), RETAIN_DAYS);
    const now = new Date();

    const accessResult = await tx.accessToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: cutoff } },
          { revoked: true, issuedAt: { lt: cutoff } },
        ],
      },
    });

    const refreshResult = await tx.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: cutoff } },
          { revoked: true, issuedAt: { lt: cutoff } },
        ],
      },
    });

    // CHANGED: Use expiresAt < NOW() — JTIs are only needed until their
    // parent access token expires (15min TTL). No need to retain for 7 days.
    const jtiResult = await tx.revokedJti.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    const sessionResult = await tx.session.deleteMany({
      where: {
        AND: [
          { expiresAt: { lt: cutoff } },
          { OR: [{ valid: false }, { expiresAt: { lt: now } }] },
        ],
      },
    });

    const breakdown = {
      accessTokens: accessResult.count,
      refreshTokens: refreshResult.count,
      revokedJtis: jtiResult.count,
      expiredSessions: sessionResult.count,
    };

    const deleted =
      breakdown.accessTokens +
      breakdown.refreshTokens +
      breakdown.revokedJtis +
      breakdown.expiredSessions;

    logger.info(
      { deleted, breakdown, lockKey: ADVISORY_LOCK_KEY },
      "[TOKEN_CLEANUP] Cleanup complete",
    );

    return { skipped: false, deleted, breakdown };
  });
}
