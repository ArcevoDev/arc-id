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
//   If Redis is not configured or unavailable, an in-memory Map takes over.
//   This is safe within a single Node.js process (event loop is
//   single-threaded). NOT safe across multiple processes — use Redis in
//   production. The DB RevokedJti check in auth-guard remains authoritative.

import { config } from "@/core/config";
import { logger } from "@/lib/logger";

// ── In-memory fallback ────────────────────────────────────────────────────────
// Keyed by the full Redis key string. Value is the expiry timestamp (ms).
const memStore = new Map<string, number>();

// ── Redis init (lazy, same pattern as challenge-store.ts) ─────────────────────

let _redis: import("@upstash/redis").Redis | null = null;

async function getRedis(): Promise<import("@upstash/redis").Redis | null> {
  if (!config.redis.enabled) return null;
  if (_redis) return _redis;

  try {
    const { Redis } = await import("@upstash/redis");
    _redis = new Redis({ url: config.redis.url!, token: config.redis.token! });
    return _redis;
  } catch (err) {
    logger.error(
      { err },
      "[JTI_BLOCKLIST] Redis init failed — falling back to in-memory store",
    );
    return null;
  }
}

// ── Key scheme ────────────────────────────────────────────────────────────────

const jtiKey = (jti: string): string => `arcid:revoked_jti:${jti}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Add a JTI to the blocklist.
 *
 * @param jti         The JWT ID claim value.
 * @param ttlSeconds  How long to keep the block. Should equal the remaining
 *                    lifetime of the access token (expiresAt - now). Pass 0
 *                    to use the default access token TTL (900s = 15min).
 */
export async function blockJti(jti: string, ttlSeconds = 900): Promise<void> {
  const ttl = Math.max(ttlSeconds, 1);
  const key = jtiKey(jti);

  const r = await getRedis();

  if (r) {
    try {
      await r.set(key, "1", { ex: ttl });
      return;
    } catch (err) {
      logger.warn(
        { err, jti },
        "[JTI_BLOCKLIST] Failed to write to Redis — falling back to in-memory",
      );
    }
  }

  // In-memory fallback
  memStore.set(key, now() + ttl * 1000);
  logger.warn(
    { jti },
    "[JTI_BLOCKLIST] Using in-memory store — not safe for multi-process deployments",
  );
}

/**
 * Check if a JTI is in the blocklist.
 *
 * Returns:
 *   true  — JTI is definitively blocked (Redis or in-memory confirmed)
 *   false — JTI is not blocked (caller should check DB as authoritative fallback)
 */
export async function isJtiBlocked(jti: string): Promise<boolean> {
  const key = jtiKey(jti);
  const r = await getRedis();

  if (r) {
    try {
      const val = await r.get(key);
      return val !== null;
    } catch (err) {
      logger.warn(
        { err, jti },
        "[JTI_BLOCKLIST] Redis GET failed — falling through to in-memory check",
      );
    }
  }

  // In-memory fallback
  const expiresAt = memStore.get(key);
  if (expiresAt === undefined) return false;
  if (expiresAt < now()) {
    memStore.delete(key);
    return false;
  }
  return true;
}

/**
 * Remove a JTI from the blocklist.
 * Typically not needed (TTL handles expiry) but useful for testing.
 */
export async function unblockJti(jti: string): Promise<void> {
  const key = jtiKey(jti);
  const r = await getRedis();

  if (r) {
    try {
      await r.del(key);
      return;
    } catch {
      // Non-fatal
    }
  }

  memStore.delete(key);
}

/** Flush all in-memory entries. Useful in tests. */
export function clearMemStore(): void {
  memStore.clear();
}
