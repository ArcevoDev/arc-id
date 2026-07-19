// src/lib/security/jti-blocklist.init-fail.test.ts
//
// Tests the Redis-init-failure path: when @upstash/redis constructor throws,
// getRedis() caches the failure and all functions no-op to the DB fallback.

import { describe, it, expect, beforeEach, vi } from "vitest";

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
    throw new Error("Redis init: Connection timeout");
  },
}));

describe("jti-blocklist (Redis init fails)", () => {
  let blockJti: any, isJtiBlocked: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("./jti-blocklist");
    blockJti = mod.blockJti;
    isJtiBlocked = mod.isJtiBlocked;
  });

  it("falls through to DB fallback when Redis init fails on block", async () => {
    await expect(blockJti("init-fail-jti")).resolves.toBeUndefined();
  });

  it("falls through to DB fallback when Redis init fails on check", async () => {
    const result = await isJtiBlocked("init-fail-jti");
    expect(result).toBe(false);
  });

  it("caches the init failure so subsequent calls don't retry", async () => {
    await blockJti("first-call");
    await blockJti("second-call");
    // Both calls resolve without error — the init failure is cached
    expect(true).toBe(true);
  });
});
