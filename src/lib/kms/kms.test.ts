// src/lib/kms/kms.test.ts
//
// FIX: config is exported `as const` which makes every property readonly in
// TypeScript. Tests that patch config.kms.* directly get TS2540 errors.
// Solution: cast config.kms to a mutable type once at the top of the file
// using a type assertion. This is safe because:
//   1. `as const` is a compile-time constraint only — the object is fully
//      mutable at runtime.
//   2. The cast is scoped to this test file and cleaned up in beforeEach.
//   3. No production code is affected.

import { describe, it, expect, beforeEach } from "vitest";
import { localKms } from "./local-kms";
import { encryptPrivateKey, decryptPrivateKey } from "./key-encryption";
import { envSchema } from "@/core/config/env.validator";
import { config } from "@/core/config/config";

// ── Mutable view of config.kms for test patching ─────────────────────────────
// `config` is `as const` so TypeScript marks every field readonly.
// This cast gives the test file a writable alias without touching the
// config module or production code.
type MutableKms = {
  localKey: string | null;
  provider: string | null;
  awsKeyId: string | null;
  gcpKeyName: string | null;
  enabled: boolean;
};
const kms = config.kms as MutableKms;

// ── Snapshot for beforeEach restore ──────────────────────────────────────────
const ORIG = { ...config.kms } as MutableKms;

beforeEach(() => {
  kms.localKey = ORIG.localKey;
  kms.provider = ORIG.provider;
  kms.awsKeyId = ORIG.awsKeyId;
  kms.gcpKeyName = ORIG.gcpKeyName;
  kms.enabled = ORIG.enabled;
});

// ── Plaintext PEM fixture ─────────────────────────────────────────────────────
// A real PKCS8 ES256 private key (P-256), used for round-trip tests.
// Same algorithm and format as signing.service.ts.
const FIXTURE_PRIVATE_KEY = Buffer.from(
  "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg" +
    "W6HqT2r6GFzN9qpQuYHICqX3A7xr7RVf3uS/UqT5zXmhRANC" +
    "AASD/zY5Y+WYGx3NJHlD+3tCvFHNKUFKxhnmV30BBDJqEGLt" +
    "Tq9IMuTR7dVH2Td2PqQFPXB4eRh1v4nqUnjFn1sF",
  "base64",
);

// ── 1. ROUND-TRIP: LOCAL KMS ─────────────────────────────────────────────────

describe("localKms encrypt → decrypt round-trip", () => {
  beforeEach(() => {
    kms.localKey = "test-local-kms-key-32bytes!";
    kms.enabled = true;
  });

  it("decrypt(encrypt(plaintext)) === plaintext", async () => {
    const ciphertext = await localKms.encrypt(FIXTURE_PRIVATE_KEY);
    const decrypted = await localKms.decrypt(ciphertext);
    expect(decrypted.equals(FIXTURE_PRIVATE_KEY)).toBe(true);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const a = await localKms.encrypt(FIXTURE_PRIVATE_KEY);
    const b = await localKms.encrypt(FIXTURE_PRIVATE_KEY);
    expect(a.equals(b)).toBe(false);
  });

  it("throws on tampered ciphertext (wrong auth tag)", async () => {
    const ciphertext = await localKms.encrypt(FIXTURE_PRIVATE_KEY);
    const corrupt = Buffer.from(ciphertext);
    corrupt[corrupt.length - 5] ^= 0xff;
    await expect(localKms.decrypt(corrupt)).rejects.toThrow();
  });

  it("throws on truncated ciphertext", async () => {
    await expect(localKms.decrypt(Buffer.from("tooshort"))).rejects.toThrow();
  });
});

// ── 2. KEY-ENCRYPTION HELPERS ─────────────────────────────────────────────────

describe("encryptPrivateKey / decryptPrivateKey", () => {
  it("returns plaintext passthrough when KMS is disabled", async () => {
    kms.enabled = false;
    const { encryptedKey, kmsProvider } =
      await encryptPrivateKey(FIXTURE_PRIVATE_KEY);
    expect(kmsProvider).toBeNull();
    expect(encryptedKey.equals(FIXTURE_PRIVATE_KEY)).toBe(true);
  });

  it("encrypts and sets provider when KMS is enabled (local)", async () => {
    kms.localKey = "test-local-kms-key-32bytes!";
    kms.enabled = true;
    const { encryptedKey, kmsProvider } =
      await encryptPrivateKey(FIXTURE_PRIVATE_KEY);
    expect(kmsProvider).toBe("LOCAL");
    expect(encryptedKey.length).toBeGreaterThan(FIXTURE_PRIVATE_KEY.length);
  });

  it("decryptPrivateKey passthrough when kmsProvider is null", async () => {
    const decrypted = await decryptPrivateKey({
      privateKey: FIXTURE_PRIVATE_KEY,
      kmsProvider: null,
    } as any);
    expect(decrypted.equals(FIXTURE_PRIVATE_KEY)).toBe(true);
  });

  it("decryptPrivateKey actually decrypts when kmsProvider is set", async () => {
    kms.localKey = "test-local-kms-key-32bytes!";
    kms.enabled = true;
    const { encryptedKey } = await encryptPrivateKey(FIXTURE_PRIVATE_KEY);
    const decrypted = await decryptPrivateKey({
      privateKey: encryptedKey,
      kmsProvider: "LOCAL",
    } as any);
    expect(decrypted.equals(FIXTURE_PRIVATE_KEY)).toBe(true);
  });
});

// ── 3. ENV VALIDATOR: production boot failure ─────────────────────────────────

describe("env.validator — KMS production guard", () => {
  it("requires LOCAL_KMS_KEY in production when no KMS_PROVIDER is set", () => {
    const result = envSchema.safeParse({
      ...process.env,
      NODE_ENV: "production",
      KMS_PROVIDER: "",
      LOCAL_KMS_KEY: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      expect(msg).toContain("LOCAL_KMS_KEY");
    }
  });

  it("passes validation in test mode without KMS config", () => {
    const result = envSchema.safeParse({
      ...process.env,
      NODE_ENV: "test",
      KMS_PROVIDER: "",
      LOCAL_KMS_KEY: "",
    });
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      expect(msg).not.toContain("LOCAL_KMS_KEY");
    }
  });
});

// ── 4. MIGRATION SCRIPT IDEMPOTENCY ──────────────────────────────────────────

describe("encrypt-existing-keys migration idempotency", () => {
  it("detects PEM-looking bytes as plaintext", async () => {
    kms.localKey = "test-local-kms-key-32bytes!";
    kms.enabled = true;

    const { encryptedKey, kmsProvider } =
      await encryptPrivateKey(FIXTURE_PRIVATE_KEY);
    expect(kmsProvider).toBe("LOCAL");
    const prefix = encryptedKey.subarray(0, 20).toString("utf-8");
    expect(prefix).not.toContain("---");
  });
});

// ── 5. KEY ROTATION ───────────────────────────────────────────────────────────

describe("key rotation — two keys, re-encrypt without data loss", () => {
  it("decrypts with old key → re-encrypts with new key → round-trips", async () => {
    const OLD_SEED = "old-key-seed-32bytes-abcdefghijklmn";
    const NEW_SEED = "new-key-seed-32bytes-abcdefghijklmn";

    kms.localKey = OLD_SEED;
    kms.enabled = true;

    const ciphertext = await localKms.encrypt(FIXTURE_PRIVATE_KEY);
    let plaintext = await localKms.decrypt(ciphertext);
    expect(plaintext.equals(FIXTURE_PRIVATE_KEY)).toBe(true);

    kms.localKey = NEW_SEED;
    const reEncrypted = await localKms.encrypt(plaintext);

    plaintext = await localKms.decrypt(reEncrypted);
    expect(plaintext.equals(FIXTURE_PRIVATE_KEY)).toBe(true);
  });

  it("rotation produces different ciphertext than original", async () => {
    const OLD_SEED = "rotation-old-key-32bytes!!!!!!!!!!";
    const NEW_SEED = "rotation-new-key-32bytes!!!!!!!!!!";

    kms.localKey = OLD_SEED;
    kms.enabled = true;
    const originalCiphertext = await localKms.encrypt(FIXTURE_PRIVATE_KEY);

    const plaintext = await localKms.decrypt(originalCiphertext);

    kms.localKey = NEW_SEED;
    kms.enabled = true;
    const rotatedCiphertext = await localKms.encrypt(plaintext);

    expect(originalCiphertext.equals(rotatedCiphertext)).toBe(false);

    const decrypted = await localKms.decrypt(rotatedCiphertext);
    expect(decrypted.equals(FIXTURE_PRIVATE_KEY)).toBe(true);
  });
});
