import { describe, it, expect } from "vitest";
import { ApiKeyService } from "./api-key.service";

describe("ApiKeyService", () => {
  const service = new ApiKeyService();

  describe("generate", () => {
    it("produces a key with the arc_sk_ prefix", () => {
      const { key } = service.generate();
      expect(key.startsWith("arc_sk_")).toBe(true);
    });

    it("generates a key of at least 32 bytes of entropy", () => {
      const { key } = service.generate();
      const raw = key.slice("arc_sk_".length);
      const bytes = Buffer.from(raw, "base64url");
      expect(bytes.length).toBeGreaterThanOrEqual(32);
    });

    it("returns a different key each time", () => {
      const a = service.generate();
      const b = service.generate();
      expect(a.key).not.toBe(b.key);
    });

    it("returns a SHA-256 hex hash (64 chars)", () => {
      const { hash } = service.generate();
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns a short display prefix", () => {
      const { prefix } = service.generate();
      expect(prefix.length).toBe(12);
      expect(prefix).toBeTypeOf("string");
    });
  });

  describe("hash", () => {
    it("is deterministic for the same input", () => {
      const { key, hash } = service.generate();
      const rehashed = service.hash(key);
      expect(rehashed).toBe(hash);
    });

    it("produces different hashes for different inputs", () => {
      const { key: a } = service.generate();
      const { key: b } = service.generate();
      expect(service.hash(a)).not.toBe(service.hash(b));
    });
  });

  describe("verify", () => {
    it("returns true for a matching key", () => {
      const { key, hash } = service.generate();
      expect(service.verify(key, hash)).toBe(true);
    });

    it("returns false for a non-matching key", () => {
      const { key } = service.generate();
      const { hash: otherHash } = service.generate();
      expect(service.verify(key, otherHash)).toBe(false);
    });
  });
});
