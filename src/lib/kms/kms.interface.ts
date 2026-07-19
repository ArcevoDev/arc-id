/**
 * KMS envelope encryption interface.
 *
 * Every implementation encrypts/decrypts at the bytes level. The TenantSigningKey
 * model stores ciphertext in its `privateKey` Bytes column and records which
 * provider encrypted it in `kmsProvider`.  The column stays the same type
 * regardless of backend — only the bytes you put in change.
 *
 * Local mode packs the ciphertext as [iv (12) + authTag (16) + ciphertext (N)].
 * AWS KMS returns a self-describing ciphertext blob from EncryptCommand.
 * GCP KMS returns a self-describing ciphertext blob from encrypt().
 *
 * All three share the same Buffer→Buffer contract so the call sites in
 * provision-tenant-did.flow.ts, signing.service.ts, and the migration script
 * never need to know which backend is active.
 */
export interface KmsEnvelope {
  /** Provider identifier stored on TenantSigningKey.kmsProvider. */
  readonly provider: string;

  /** Encrypt plaintext bytes.  The returned Buffer includes everything needed
   *  to decrypt (IV, auth tag, and ciphertext are packed together). */
  encrypt(plaintext: Buffer): Promise<Buffer>;

  /** Reverse of encrypt().  Throws on tampered ciphertext, wrong key, or
   *  truncated payload. */
  decrypt(ciphertext: Buffer): Promise<Buffer>;
}
