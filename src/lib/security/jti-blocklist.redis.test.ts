// src/lib/security/jti-blocklist.redis.test.ts
//
// Tests the Redis-enabled path of jti-blocklist: block/check/unblock lifecycle,
// TTL defaults/minimums, and Redis operation failure fallback.
//
// Uses a shared mutable reference (redisInstanceRef) so the hoisted vi.mock
// factory can supply the current mockRedis instance to the @upstash/redis
// constructor.

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Shared mutable ref — hoisted vi.mock factory reads from this ────────────

const redisInstanceRef: { current: Record<string, any> | null } = {
  current: null,
};

vi.mock("@/core/config", () => ({
  config: {
    redis: {
      enabled: true,
      url: "https://mock.upstash.io",
      token: "mock-token",
    },
    base: {
      env: "test",
      logLevel: "silent",
      isTest: true,
      isDevelopment: false,
      isProduction: false,
    },
  },
}));
vi.mock("@upstash/redis", () => ({
  Redis: function () {
    return redisInstanceRef.current as any;
  },
}));

// ── Mock Redis factory ──────────────────────────────────────────────────────

const store = new Map<string, string>();

function createMockRedis() {
  return {
    set: vi.fn(async (key: string, value: string, opts?: { ex?: number }) => {
      if (opts?.ex !== undefined) {
        store.set(key, value);
      } else {
        store.set(key, value);
      }
      return "OK";
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    ttl: vi.fn(async (_key: string) => 800),
  };
}

function resetStore() {
  store.clear();
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("jti-blocklist (Redis enabled)", () => {
  let blockJti: any, isJtiBlocked: any, unblockJti: any;
  let mockRedis: Record<string, any>;

  beforeEach(async () => {
    resetStore();
    mockRedis = createMockRedis();
    redisInstanceRef.current = mockRedis;
    vi.resetModules();
    const mod = await import("./jti-blocklist");
    blockJti = mod.blockJti;
    isJtiBlocked = mod.isJtiBlocked;
    unblockJti = mod.unblockJti;
  });

  it("blockJti writes to Redis with the correct key prefix", async () => {
    await blockJti("uuid-abc-123", 900);
    expect(mockRedis.set).toHaveBeenCalledWith(
      "arcid:revoked_jti:uuid-abc-123",
      "1",
      { ex: 900 },
    );
  });

  it("isJtiBlocked returns true for a blocked JTI", async () => {
    await blockJti("blocked-jti", 900);
    expect(await isJtiBlocked("blocked-jti")).toBe(true);
  });

  it("isJtiBlocked returns false for a non-blocked JTI", async () => {
    expect(await isJtiBlocked("unknown-jti")).toBe(false);
  });

  it("block/unblock lifecycle works correctly", async () => {
    await blockJti("lifecycle-jti", 900);
    expect(await isJtiBlocked("lifecycle-jti")).toBe(true);

    await unblockJti("lifecycle-jti");
    expect(await isJtiBlocked("lifecycle-jti")).toBe(false);
  });

  it("uses default TTL of 900s when no ttlSeconds supplied", async () => {
    await blockJti("no-ttl-jti");
    expect(mockRedis.set).toHaveBeenCalledWith(expect.any(String), "1", {
      ex: 900,
    });
  });

  it("enforces minimum TTL of 1 second", async () => {
    await blockJti("zero-ttl-jti", 0);
    expect(mockRedis.set).toHaveBeenCalledWith(expect.any(String), "1", {
      ex: 1,
    });
  });

  it("falls through to DB path on Redis GET failure", async () => {
    mockRedis.get.mockRejectedValueOnce(new Error("Connection refused"));
    const result = await isJtiBlocked("failing-jti");
    expect(result).toBe(false);
  });

  it("falls through to DB path on Redis SET failure (non-fatal)", async () => {
    mockRedis.set.mockRejectedValueOnce(new Error("Connection refused"));
    await expect(blockJti("failing-jti", 900)).resolves.toBeUndefined();
  });
});
