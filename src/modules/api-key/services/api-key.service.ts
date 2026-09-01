import { randomBytes, createHash } from "node:crypto";

const KEY_PREFIX = "arc_sk_";
const KEY_RANDOM_BYTES = 32; // 256-bit entropy
const DISPLAY_PREFIX_LENGTH = 12;

export class ApiKeyService {
  /** Generate a new API key. Returns plaintext key (shown once), SHA-256 hash, and display prefix. */
  generate(): { key: string; hash: string; prefix: string } {
    const randomPart = randomBytes(KEY_RANDOM_BYTES).toString("base64url");
    const key = `${KEY_PREFIX}${randomPart}`;
    const hash = this.hash(key);
    const prefix = key.slice(0, DISPLAY_PREFIX_LENGTH);
    return { key, hash, prefix };
  }

  /** Hash a key for storage/lookup. SHA-256 only — never store plaintext. */
  hash(key: string): string {
    return createHash("sha-256").update(key).digest("hex");
  }

  /** Verify a key matches a stored hash. */
  verify(key: string, hash: string): boolean {
    return this.hash(key) === hash;
  }
}
