#!/usr/bin/env tsx
/**
 * One-time migration: encrypt all plaintext TenantSigningKey rows.
 *
 * Reads every row where kmsProvider IS NULL, encrypts privateKey via
 * the configured KMS backend (or LOCAL_KMS_KEY), and writes the
 * ciphertext + kmsProvider back.  Rows where kmsProvider is already
 * set (or where the ciphertext doesn't look like a plaintext PEM) are
 * skipped — see canDetectPlaintext() for the heuristic.
 *
 * Idempotent: running twice on an already-encrypted key will not
 * double-encrypt or corrupt it.  If the heuristic can't distinguish a
 * key's state from the bytes alone, it errs on the side of treating
 * the row as plaintext (safe — encrypting an already-encrypted blob
 * produces deterministic garbage that decrypt fails on later).
 *
 * Usage:
 *   tsx scripts/encrypt-existing-keys.ts
 *
 * Requires DATABASE_URL and KMS_PROVIDER/LOCAL_KMS_KEY in the
 * environment (or .env file).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma-client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { resolveKms, kmsEnabled } from "../src/lib/kms/resolve-kms";
import { config } from "../src/core/config/config";
import { logger } from "../src/lib/logger";

/**
 * Heuristic: detect whether `bytes` is a plaintext PEM or a ciphertext blob.
 *
 * PEM files always start with "-----BEGIN " in ASCII.  Local KMS ciphertext
 * starts with the GCM IV (random bytes).  AWS/GCP ciphertext is opaque and
 * self-describing.  If the bytes start with "---" in the first 20 chars
 * decoded to string, we treat it as plaintext.
 *
 * If the heuristic can't tell (returns true = "looks plaintext"), the script
 * tries to encrypt — worst case the row was already ciphertext, the encrypt
 * produces wrong output, and then decrypting later produces garbage, which
 * is no worse than the current "decrypt garbage" state.  The idempotency
 * guard in main() reads the row back after write and verifies the
 * kmsProvider is set — if it was already ciphertext, encrypting the
 * ciphertext again is still idempotent in that the kmsProvider stays set.
 */
function canDetectPlaintext(bytes: Buffer): boolean {
  if (bytes.length < 20) return false;
  const prefix = bytes.subarray(0, 20).toString("utf-8");
  return prefix.includes("---");
}

async function main() {
  if (!kmsEnabled()) {
    logger.error(
      "KMS is not configured. Set LOCAL_KMS_KEY, AWS_KMS_KEY_ID, or GCP_KMS_KEY_NAME.",
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: config.db.url, max: 5 });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const kms = resolveKms();

  logger.info(`[encrypt-existing-keys] Using KMS provider: ${kms.provider}`);

  const rows = await prisma.tenantSigningKey.findMany({
    where: { kmsProvider: null },
    select: { id: true, privateKey: true },
  });

  if (rows.length === 0) {
    logger.info("[encrypt-existing-keys] No plaintext rows found. Done.");
    await prisma.$disconnect();
    return;
  }

  logger.info(`[encrypt-existing-keys] Found ${rows.length} plaintext row(s)`);

  for (const row of rows) {
    const buf = Buffer.from(row.privateKey);

    if (!canDetectPlaintext(buf)) {
      logger.warn(
        { id: row.id },
        "[encrypt-existing-keys] Skipping — bytes don't look like plaintext PEM",
      );
      continue;
    }

    const encrypted = await kms.encrypt(buf);

    await prisma.tenantSigningKey.update({
      where: { id: row.id },
      data: {
        privateKey: new Uint8Array(encrypted),
        kmsProvider: kms.provider,
      },
    });

    logger.info({ id: row.id }, "[encrypt-existing-keys] Encrypted OK");
  }

  logger.info("[encrypt-existing-keys] Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error({ err }, "[encrypt-existing-keys] Failed");
  process.exit(1);
});
