#!/usr/bin/env tsx
/**
 * KMS key rotation script.
 *
 * Re-encrypts every TenantSigningKey row under a new KMS key.
 *
 * SAFETY:
 *   - Decrypts the row's current ciphertext using the OLD KMS config
 *     (read from the environment BEFORE changing KMS_PROVIDER / key ID).
 *   - Re-encrypts with the NEW KMS config (read from environment AFTER
 *     updating env vars).
 *   - Each row is updated atomically: decrypted → encrypted in memory,
 *     then one UPDATE.  If the script fails part-way through, every
 *     unmigrated row is still readable by the old key.  No downtime on
 *     unmigrated rows.
 *
 * USAGE:
 *   1. Point env to OLD KMS key: ensure KMS_PROVIDER + key ID in .env
 *      match the current active config.
 *   2. Set ROTATE_KMS_PROVIDER, ROTATE_AWS_KMS_KEY_ID or
 *      ROTATE_GCP_KMS_KEY_NAME or ROTATE_LOCAL_KMS_KEY to the
 *      new key config.
 *   3. Run: tsx scripts/rotate-kms-key.ts
 *   4. After completion, update your regular env vars to match the
 *      new key — the old key is no longer needed for any row.
 *
 * The script decodes new-key config from ROTATE_* env vars so both
 * old and new keys are available simultaneously during rotation.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma-client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { resolveKms } from "../src/lib/kms/resolve-kms";
import { config } from "../src/core/config/config";
import { localKms } from "../src/lib/kms/local-kms";
import { createAwsKms } from "../src/lib/kms/aws-kms";
import { createGcpKms } from "../src/lib/kms/gcp-kms";
import type { KmsEnvelope } from "../src/lib/kms/kms.interface";
import { logger } from "../src/lib/logger";

function resolveNewKms(): KmsEnvelope {
  const provider = process.env.ROTATE_KMS_PROVIDER ?? config.kms.provider;
  const awsKeyId = process.env.ROTATE_AWS_KMS_KEY_ID ?? config.kms.awsKeyId;
  const gcpKeyName =
    process.env.ROTATE_GCP_KMS_KEY_NAME ?? config.kms.gcpKeyName;
  const localKey = process.env.ROTATE_LOCAL_KMS_KEY ?? config.kms.localKey;

  if (provider === "AWS" && awsKeyId) return createAwsKms(awsKeyId);
  if (provider === "GCP" && gcpKeyName) return createGcpKms(gcpKeyName);
  if (localKey) return localKms;

  throw new Error(
    "No new KMS key configured. Set ROTATE_KMS_PROVIDER + ROTATE_*_KMS_KEY_*",
  );
}

async function main() {
  const pool = new Pool({ connectionString: config.db.url, max: 5 });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const oldKms = resolveKms();
  const newKms = resolveNewKms();

  logger.info(
    `[rotate-kms] Old provider: ${oldKms.provider} → New provider: ${newKms.provider}`,
  );

  const rows = await prisma.tenantSigningKey.findMany({
    select: { id: true, privateKey: true, kmsProvider: true },
  });

  if (rows.length === 0) {
    logger.info("[rotate-kms] No signing keys found. Done.");
    await prisma.$disconnect();
    return;
  }

  logger.info(`[rotate-kms] Rotating ${rows.length} key(s)`);

  for (const row of rows) {
    const ciphertext = Buffer.from(row.privateKey);

    if (!row.kmsProvider) {
      // Plaintext row — just encrypt under the new key directly
      const reEncrypted = await newKms.encrypt(ciphertext);
      await prisma.tenantSigningKey.update({
        where: { id: row.id },
        data: {
          privateKey: new Uint8Array(reEncrypted),
          kmsProvider: newKms.provider,
        },
      });
      logger.info({ id: row.id }, "[rotate-kms] Encrypted plaintext OK");
      continue;
    }

    // Decrypt with old, re-encrypt with new
    const plaintext = await oldKms.decrypt(ciphertext);
    const reEncrypted = await newKms.encrypt(plaintext);

    await prisma.tenantSigningKey.update({
      where: { id: row.id },
      data: {
        privateKey: new Uint8Array(reEncrypted),
        kmsProvider: newKms.provider,
      },
    });

    logger.info({ id: row.id }, "[rotate-kms] Rotated OK");
  }

  logger.info("[rotate-kms] Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error({ err }, "[rotate-kms] Failed");
  process.exit(1);
});
