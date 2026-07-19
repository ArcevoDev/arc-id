/**
 * Key encryption/decryption helpers for TenantSigningKey.
 *
 * These are the single point of contact for provision-tenant-did.flow.ts
 * and signing.service.ts.  They handle the "no KMS → plaintext passthrough"
 * case so the call sites don't need conditionals.
 */
import { resolveKms, kmsEnabled } from "./resolve-kms";
import type { TenantSigningKey } from "@prisma-client";

/**
 * Encrypt a private key for storage.  When KMS is not configured, returns
 * the plaintext bytes unchanged (legacy mode).  When KMS is enabled, returns
 * the ciphertext and the corresponding provider string.
 */
export async function encryptPrivateKey(
  privateKeyBytes: Buffer,
): Promise<{ encryptedKey: Buffer; kmsProvider: string | null }> {
  if (!kmsEnabled()) {
    return { encryptedKey: privateKeyBytes, kmsProvider: null };
  }
  const kms = resolveKms();
  const encryptedKey = await kms.encrypt(privateKeyBytes);
  return { encryptedKey, kmsProvider: kms.provider };
}

/**
 * Decrypt a private key from storage.  When `kmsProvider` is null, returns
 * the bytes unchanged (legacy plaintext).  When set, decrypts using the
 * active KMS backend.
 *
 * NOTE: The caller must NOT cache or reuse the returned Buffer beyond the
 * duration of the single signing operation.  Decrypted key material lives
 * in memory only for the sign call, then is garbage-collected.
 */
export async function decryptPrivateKey(
  key: Pick<TenantSigningKey, "privateKey" | "kmsProvider">,
): Promise<Buffer> {
  if (!key.kmsProvider) {
    // Legacy — stored as plaintext bytes
    return Buffer.from(key.privateKey);
  }
  const kms = resolveKms();
  return kms.decrypt(Buffer.from(key.privateKey));
}
