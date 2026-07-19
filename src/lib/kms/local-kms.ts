/**
 * Local KMS — AES-256-GCM envelope encryption.
 *
 * Uses the LOCAL_KMS_KEY from config as the key derivation seed.
 * Ciphertext format (single Buffer):
 *
 *   [0..11]   — IV (12 bytes, GCM standard nonce length)
 *   [12..27]  — authTag (16 bytes, GCM auth tag)
 *   [28..N]   — ciphertext (encrypted payload)
 *
 * We DO NOT add a version byte — the pack/unpack pattern is versioned
 * implicitly by the code that wrote it.  If we need a format migration
 * later, add a byte at offset 0 and check it in decrypt().
 */
import { config } from "@/core/config";
import { ApiError } from "@/core/errors";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { KmsEnvelope } from "./kms.interface";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended nonce length for GCM
const AUTH_TAG_LENGTH = 16;

/** Derive a 256-bit AES key from the LOCAL_KMS_KEY env var. */
function deriveKey(): Buffer {
  const raw = config.kms.localKey;
  if (!raw) {
    throw ApiError.internal(
      "LOCAL_KMS_KEY is not configured but local KMS was selected",
    );
  }
  // Support both hex-encoded 64-char keys and arbitrary-length seeds
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  // Arbitrary-length seed → SHA-256 hash → 32-byte key
  return createHash("sha256").update(raw, "utf-8").digest();
}

export const localKms: KmsEnvelope = {
  provider: "LOCAL",

  async encrypt(plaintext: Buffer): Promise<Buffer> {
    const key = deriveKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]);
  },

  async decrypt(ciphertext: Buffer): Promise<Buffer> {
    const key = deriveKey();
    if (ciphertext.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      throw ApiError.internal("KMS ciphertext too short");
    }
    const iv = ciphertext.subarray(0, IV_LENGTH);
    const authTag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = ciphertext.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  },
};
