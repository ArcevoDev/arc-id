// src/lib/security/jti-blocklist.test.ts
//
// Covers both the Redis-disabled (no-op) path and the Redis-enabled path:
// block/check/unblock lifecycle, Redis failure fallback (init crash → DB path),
// and TTL key expiry.
//
// The Redis-disabled tests use top-level vi.mock (hoisted). The Redis-enabled
// tests are in a separate file (jti-blocklist.redis.test.ts) using the same
// vi.mock pattern to avoid hoisting conflicts with vi.doMock.

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/core/config", () => ({
  config: {
    redis: { enabled: false, url: null, token: null },
    base: {
      env: "test",
      logLevel: "silent",
      isTest: true,
      isDevelopment: false,
      isProduction: false,
    },
  },
}));

describe("jti-blocklist (Redis disabled)", () => {
  let blockJti: any, isJtiBlocked: any, unblockJti: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("./jti-blocklist");
    blockJti = mod.blockJti;
    isJtiBlocked = mod.isJtiBlocked;
    unblockJti = mod.unblockJti;
  });

  it("blockJti no-ops when Redis is disabled", async () => {
    await expect(blockJti("test-jti")).resolves.toBeUndefined();
  });

  it("isJtiBlocked returns false when Redis is disabled", async () => {
    const result = await isJtiBlocked("test-jti");
    expect(result).toBe(false);
  });

  it("unblockJti no-ops when Redis is disabled", async () => {
    await expect(unblockJti("test-jti")).resolves.toBeUndefined();
  });
});
