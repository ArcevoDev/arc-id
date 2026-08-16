// src/lib/security/jti-blocklist.init-fail.test.ts
//
// Tests the Redis-init-failure path: when @upstash/redis constructor throws,
// getRedis() returns null and the in-memory Map fallback is used.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { clearMemStore } from "./jti-blocklist";

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

describe("jti-blocklist (Redis init fails → in-memory fallback)", () => {
  let blockJti: any, isJtiBlocked: any, unblockJti: any;

  beforeEach(async () => {
    vi.resetModules();
    clearMemStore();
    const mod = await import("./jti-blocklist");
    blockJti = mod.blockJti;
    isJtiBlocked = mod.isJtiBlocked;
    unblockJti = mod.unblockJti;
  });

  it("blockJti writes to in-memory store when Redis fails", async () => {
    await expect(blockJti("init-fail-jti")).resolves.toBeUndefined();
    const result = await isJtiBlocked("init-fail-jti");
    expect(result).toBe(true);
  });

  it("isJtiBlocked falls through to in-memory check", async () => {
    const result = await isJtiBlocked("init-fail-jti");
    expect(result).toBe(false);
  });

  it("block/unblock lifecycle works via in-memory fallback", async () => {
    await blockJti("lifecycle-jti", 900);
    expect(await isJtiBlocked("lifecycle-jti")).toBe(true);

    await unblockJti("lifecycle-jti");
    expect(await isJtiBlocked("lifecycle-jti")).toBe(false);
  });
});
