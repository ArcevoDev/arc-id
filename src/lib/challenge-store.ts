// src/lib/challenge-store.ts
// WebAuthn challenge storage with ceremony-type isolation and atomic consume.
//
// Key design changes from previous version:
//   - Ceremony type ("registration" | "authentication") is part of the key.
//     A registration and authentication challenge for the same user no longer
//     collide. This was a silent correctness bug.
//   - Each challenge is assigned a UUID (challengeId) returned to the caller.
//     Routes can cross-check this ID during verification for extra ceremony binding.
//   - Redis consume uses GETDEL — a single atomic command.
//     The old get() + del() pattern had a race window: if two requests arrived
//     simultaneously, both could receive the same challenge before either deleted it.
//   - TTLs are ceremony-specific (registration is longer; authentication shorter).
//   - In-memory fallback is safe within a single Node.js process (event loop is
//     single-threaded). NOT safe across multiple processes — use Redis in production.
import { randomUUID } from "crypto";
import { config } from "@/core/config";
import { logger } from "@/lib/logger";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CeremonyType = "registration" | "authentication";

export interface StoredChallenge {
  /** Opaque ID you can bind to the ceremony — pass back to consumeChallenge for verification. */
  challengeId: string;
  challenge: string;
}

interface ChallengeEntry extends StoredChallenge {
  expiresAt: number;
}

// ── Config ─────────────────────────────────────────────────────────────────────

/** TTL in seconds per ceremony type. Registration gives more time for device prompts. */
const TTL_SEC: Record<CeremonyType, number> = {
  registration: 120, // 2 minutes
  authentication: 90, // 1.5 minutes
};

// ── Key scheme ─────────────────────────────────────────────────────────────────
// Previous scheme: `passkey:challenge:${identityId}`
// New scheme:      `passkey:challenge:${ceremony}:${identityId}`
// Ceremony is part of the key, so registration and auth challenges are isolated.
const challengeKey = (identityId: string, ceremony: CeremonyType): string =>
  `passkey:challenge:${ceremony}:${identityId}`;

// ── In-memory fallback ────────────────────────────────────────────────────────
// Keyed by the full challengeKey string (includes ceremony type).
const memStore = new Map<string, ChallengeEntry>();

// ── Lazy Redis init ───────────────────────────────────────────────────────────

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
      "[CHALLENGE_STORE] Redis init failed — falling back to memory",
    );
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Store a WebAuthn challenge for a given user and ceremony type.
 * Overwrites any existing challenge for this (identityId, ceremony) pair.
 * Returns a challengeId that can be bound to the WebAuthn options object.
 */
export async function storeChallenge(
  identityId: string,
  ceremony: CeremonyType,
  challenge: string,
): Promise<StoredChallenge> {
  const challengeId = randomUUID();
  const ttl = TTL_SEC[ceremony];
  const k = challengeKey(identityId, ceremony);
  const entry: ChallengeEntry = {
    challengeId,
    challenge,
    expiresAt: Date.now() + ttl * 1000,
  };

  const r = await getRedis();

  if (r) {
    await r.set(k, JSON.stringify(entry), { ex: ttl });
  } else {
    memStore.set(k, entry);
    logger.warn(
      { identityId, ceremony },
      "[CHALLENGE_STORE] Using in-memory store — not safe for multi-process deployments",
    );
  }

  return { challengeId, challenge };
}

/**
 * Consume (read + delete atomically) a challenge.
 * Returns null if no challenge exists or it has expired.
 *
 * Redis path uses GETDEL — a single atomic command (Redis 6.2+, Upstash supported).
 * Memory path is safe because Node.js Map operations are synchronous and the
 * event loop is single-threaded; there is no interleaving between get and delete.
 */
export async function consumeChallenge(
  identityId: string,
  ceremony: CeremonyType,
): Promise<StoredChallenge | null> {
  const k = challengeKey(identityId, ceremony);
  const r = await getRedis();

  if (r) {
    // GETDEL: atomically returns the value and removes the key in one round-trip.
    // No race condition possible — compare to old get() + del() pattern.
    const raw = await r.getdel<string>(k);

    if (!raw) return null;

    try {
      const entry: ChallengeEntry = JSON.parse(raw);
      return { challengeId: entry.challengeId, challenge: entry.challenge };
    } catch (err) {
      logger.error(
        { err, identityId, ceremony },
        "[CHALLENGE_STORE] Failed to parse stored challenge",
      );
      return null;
    }
  }

  // In-memory path: get + delete is safe here (single-threaded event loop).
  const entry = memStore.get(k);
  memStore.delete(k); // always delete, even if expired

  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    logger.warn(
      { identityId, ceremony },
      "[CHALLENGE_STORE] Challenge expired",
    );
    return null;
  }

  return { challengeId: entry.challengeId, challenge: entry.challenge };
}

// ── Dev utility ───────────────────────────────────────────────────────────────

/** Flush all in-memory challenges. Useful in tests. */
export function clearMemStore(): void {
  memStore.clear();
}
