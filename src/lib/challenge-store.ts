// src/lib/challenge-store.ts
// WebAuthn challenge storage with graceful Redis/in-memory fallback.
// Redis (Upstash) is used in production. In-memory map is used when
// UPSTASH_REDIS_REST_URL/TOKEN are not configured (local development).
import { config } from "@/core/config";
import { logger } from "@/lib/logger";

// ── In-memory fallback for development ────────────────────────────────────────

const memStore = new Map<string, { challenge: string; expiresAt: number }>();

// ── Lazy Redis initialisation ─────────────────────────────────────────────────

let redis: import("@upstash/redis").Redis | null = null;

async function getRedis() {
  if (!config.redis.enabled) return null;
  if (redis) return redis;

  try {
    const { Redis } = await import("@upstash/redis");
    redis = new Redis({
      url: config.redis.url!,
      token: config.redis.token!,
    });
    return redis;
  } catch (err) {
    logger.error("[CHALLENGE_STORE] Failed to initialise Redis client", {
      error: err,
    });
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const KEY = (userId: string) => `passkey:challenge:${userId}`;
const TTL_SEC = 120; // 2 minutes

/**
 * Store a WebAuthn challenge.
 * Uses Redis when available; falls back to in-process map in dev.
 */
export async function storeChallenge(
  userId: string,
  challenge: string,
): Promise<void> {
  const r = await getRedis();
  if (r) {
    await r.set(KEY(userId), challenge, { ex: TTL_SEC });
  } else {
    memStore.set(userId, {
      challenge,
      expiresAt: Date.now() + TTL_SEC * 1000,
    });
    logger.warn("[CHALLENGE_STORE] Using in-memory store — not suitable for production");
  }
}

/**
 * Consume a WebAuthn challenge (read + delete atomically).
 * Returns null if not found or expired.
 */
export async function consumeChallenge(userId: string): Promise<string | null> {
  const r = await getRedis();

  if (r) {
    const challenge = await r.get<string>(KEY(userId));
    if (challenge) await r.del(KEY(userId));
    return challenge;
  }

  const entry = memStore.get(userId);
  if (!entry) return null;
  memStore.delete(userId);

  if (entry.expiresAt < Date.now()) {
    logger.warn("[CHALLENGE_STORE] Challenge expired for user", { userId });
    return null;
  }

  return entry.challenge;
}