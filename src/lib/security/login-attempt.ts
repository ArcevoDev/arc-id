// src/lib/security/login-attempt.ts
//
// Per-email failed-login tracking and progressive account lockout.
//
// THREAT MODEL:
//   Credential stuffing — attackers rotate IPs to bypass per-IP rate limits
//   while trying many passwords against one account. The per-IP rate limit
//   on the login route (10/min) stops naive single-IP attacks. This module
//   adds a second layer: per-EMAIL failed attempt counting that survives
//   IP rotation.
//
// DESIGN:
//   - Email is hashed (SHA-256) before use as a Redis key — we never store
//     plaintext emails in Redis.
//   - Two keys per email:
//       arcid:login_fail:{emailHash}    — attempt counter, TTL resets on each failure
//       arcid:login_lock:{emailHash}    — lockout sentinel, TTL is the lockout duration
//   - On failure:  increment counter → set lockout key if threshold crossed
//   - On success:  clear both keys
//   - On check:    if lockout key exists → blocked
//
// THRESHOLDS:
//   ≥ 5 failures  → 15-minute lockout
//   ≥ 10 failures → 1-hour lockout
//   ≥ 20 failures → 24-hour lockout (persistent credential stuffing campaign)
//
// FALLBACK:
//   If Redis is unavailable, all functions silently no-op.
//   The per-IP rate limit on the route remains active.
//   Logging records the degradation.

import { createHash } from "crypto";
import { config } from "@/core/config";
import { logger } from "@/lib/logger";

// ── Redis (lazy, same pattern as jti-blocklist.ts) ────────────────────────────

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
    logger.warn(
      { err },
      "[LOGIN_ATTEMPT] Redis unavailable — per-email lockout disabled, per-IP rate limit remains active",
    );
    return null;
  }
}

// ── Key helpers ────────────────────────────────────────────────────────────────

function emailHash(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

const failKey = (h: string) => `arcid:login_fail:${h}`;
const lockKey = (h: string) => `arcid:login_lock:${h}`;

// ── Lockout thresholds ─────────────────────────────────────────────────────────

function lockoutTtlSeconds(attempts: number): number | null {
  if (attempts >= 20) return 86_400; // 24 hours
  if (attempts >= 10) return 3_600; // 1 hour
  if (attempts >= 5) return 900; // 15 minutes
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface LockoutStatus {
  locked: boolean;
  ttlSecs?: number; // seconds remaining on lockout (approximate)
}

/**
 * Check if an email is currently locked out.
 * Call this BEFORE password verification to avoid timing oracles.
 */
export async function checkLockout(email: string): Promise<LockoutStatus> {
  const r = await getRedis();
  if (!r) return { locked: false };

  try {
    const h = emailHash(email);
    const [lock, ttl] = await Promise.all([
      r.get(lockKey(h)),
      r.ttl(lockKey(h)),
    ]);

    if (lock) return { locked: true, ttlSecs: ttl > 0 ? ttl : undefined };
    return { locked: false };
  } catch (err) {
    logger.warn(
      { err },
      "[LOGIN_ATTEMPT] Redis error on lockout check — allowing request",
    );
    return { locked: false };
  }
}

/**
 * Record a failed login attempt.
 * Increments the counter and sets a lockout key if a threshold is crossed.
 * Safe to call after the auth failure is confirmed (not before).
 */
export async function recordFailure(email: string): Promise<void> {
  const r = await getRedis();
  if (!r) return;

  try {
    const h = emailHash(email);
    const fk = failKey(h);
    const lk = lockKey(h);
    const WINDOW = 15 * 60; // 15-minute sliding window for the counter

    // Increment counter, setting a TTL on first write.
    // INCR is atomic — no race between read and write.
    const count = await r.incr(fk);

    // Ensure the counter key has a TTL (first write sets it; subsequent
    // increments reset nothing — we use EXPIRE to slide the window).
    await r.expire(fk, WINDOW);

    const lockTtl = lockoutTtlSeconds(count);
    if (lockTtl !== null) {
      // Write the lockout sentinel. If a lockout already exists for a
      // shorter duration, overwrite it with the longer one.
      const existingTtl = await r.ttl(lk);
      if (existingTtl < lockTtl) {
        await r.set(lk, String(count), { ex: lockTtl });
      }

      logger.warn(
        { emailHash: h, attempts: count, lockoutSecs: lockTtl },
        "[LOGIN_ATTEMPT] Account locked out after repeated failures",
      );
    }
  } catch (err) {
    logger.warn(
      { err },
      "[LOGIN_ATTEMPT] Redis error recording failure — non-fatal",
    );
  }
}

/**
 * Clear the failure counter and lockout for an email after a successful login.
 * Should be called after a password match is confirmed.
 */
export async function clearAttempts(email: string): Promise<void> {
  const r = await getRedis();
  if (!r) return;

  try {
    const h = emailHash(email);
    await Promise.all([r.del(failKey(h)), r.del(lockKey(h))]);
  } catch (err) {
    // Non-fatal — worst case the counter is stale for a few minutes
    logger.warn(
      { err },
      "[LOGIN_ATTEMPT] Redis error clearing attempts — non-fatal",
    );
  }
}
