// src/lib/security/jti-blocklist.ts
//
// Redis-backed JTI blocklist for access token revocation.
//
// PROBLEM BEING SOLVED:
//   When an access token is revoked (via /oauth/revoke or admin suspend/ban),
//   the token's JTI is written to the RevokedJti DB table. The auth-guard
//   checks this table on every authenticated request via a point-lookup.
//
//   At scale this has two problems:
//     1. DB round-trip on every single request — high-frequency read on a
//        table that grows until the cleanup job runs.
//     2. The cleanup job only purges JTIs older than 7 days, but access
//        tokens expire in 15 minutes. We're retaining revocation records
//        14.96 days longer than necessary.
//
// SOLUTION:
//   Promote the JTI check to Redis (Upstash) with a TTL equal to the access
//   token's remaining lifetime. Redis O(1) GET vs a DB indexed lookup.
//   The DB RevokedJti table remains as the durable fallback — useful for
//   audit and for the window between Redis expiry and DB cleanup.
//
// INTEGRATION:
//   1. Call `blockJti(jti, ttlSeconds)` when revoking an access token.
//   2. Call `isJtiBlocked(jti)` in auth-guard BEFORE the DB check.
//      If Redis returns true, reject immediately (no DB hit needed).
//      If Redis is unavailable, fall through to the DB check.
//
// FALLBACK BEHAVIOUR:
//   If Redis is not configured or unavailable, all functions no-op and
//   the system falls back to the existing DB-based RevokedJti check.
//   This keeps the auth system running during Redis outages.

import { config } from "@/core/config";
import { logger } from "@/lib/logger";

// ── Redis init (lazy, same pattern as challenge-store.ts) ─────────────────────

let _redis: import("@upstash/redis").Redis | null = null;
let _initFailed = false;

async function getRedis(): Promise<import("@upstash/redis").Redis | null> {
  if (!config.redis.enabled) return null;
  if (_initFailed) return null;
  if (_redis) return _redis;

  try {
    const { Redis } = await import("@upstash/redis");
    _redis = new Redis({ url: config.redis.url!, token: config.redis.token! });
    return _redis;
  } catch (err) {
    _initFailed = true;
    logger.error(
      { err },
      "[JTI_BLOCKLIST] Redis init failed — falling back to DB-only revocation checks",
    );
    return null;
  }
}

// ── Key scheme ────────────────────────────────────────────────────────────────

const jtiKey = (jti: string): string => `arcid:revoked_jti:${jti}`;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Add a JTI to the Redis blocklist.
 *
 * @param jti         The JWT ID claim value.
 * @param ttlSeconds  How long to keep the block. Should equal the remaining
 *                    lifetime of the access token (expiresAt - now). Pass 0
 *                    to use the default access token TTL (900s = 15min).
 */
export async function blockJti(jti: string, ttlSeconds = 900): Promise<void> {
  const r = await getRedis();
  if (!r) return; // No Redis — DB-only path handles revocation

  try {
    // SET key "1" EX ttl — minimal value, we only care about key existence
    await r.set(jtiKey(jti), "1", { ex: Math.max(ttlSeconds, 1) });
  } catch (err) {
    // Non-fatal — DB RevokedJti is the authoritative store
    logger.warn(
      { err, jti },
      "[JTI_BLOCKLIST] Failed to write to Redis — DB check remains active",
    );
  }
}

/**
 * Check if a JTI is in the Redis blocklist.
 *
 * Returns:
 *   true  — JTI is definitively blocked (Redis confirmed)
 *   false — JTI is not in Redis (may still be in DB — caller should check)
 *   false — Redis unavailable (caller must fall back to DB check)
 */
export async function isJtiBlocked(jti: string): Promise<boolean> {
  const r = await getRedis();
  if (!r) return false; // No Redis — fall through to DB

  try {
    const val = await r.get(jtiKey(jti));
    return val !== null;
  } catch (err) {
    logger.warn(
      { err, jti },
      "[JTI_BLOCKLIST] Redis GET failed — falling through to DB check",
    );
    return false; // Conservative: don't block on Redis failure
  }
}

/**
 * Remove a JTI from the Redis blocklist.
 * Typically not needed (TTL handles expiry) but useful for testing.
 */
export async function unblockJti(jti: string): Promise<void> {
  const r = await getRedis();
  if (!r) return;

  try {
    await r.del(jtiKey(jti));
  } catch {
    // Non-fatal
  }
}
