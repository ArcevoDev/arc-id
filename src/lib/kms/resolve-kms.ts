/**
 * KMS resolver — selects the active implementation based on config.
 *
 * Called once at app boot (or lazily on first encrypt/decrypt).  The returned
 * KmsEnvelope instance is cached for the process lifetime because the config
 * doesn't change at runtime.
 */
import { config } from "@/core/config";
import { localKms } from "./local-kms";
import { createAwsKms } from "./aws-kms";
import { createGcpKms } from "./gcp-kms";
import type { KmsEnvelope } from "./kms.interface";

let _instance: KmsEnvelope | null = null;

export function resolveKms(): KmsEnvelope {
  if (_instance) return _instance;

  const kms = config.kms;

  if (kms.provider === "AWS" && kms.awsKeyId) {
    _instance = createAwsKms(kms.awsKeyId);
  } else if (kms.provider === "GCP" && kms.gcpKeyName) {
    _instance = createGcpKms(kms.gcpKeyName);
  } else if (kms.localKey) {
    _instance = localKms;
  } else {
    // No KMS configured — this is not an error per se; it means
    // TenantSigningKey.privateKey is stored as plaintext (legacy mode).
    // The encrypt/decrypt helpers in provision-tenant-did.flow.ts and
    // signing.service.ts handle this by skipping encryption.
    _instance = null as any;
  }

  return _instance as KmsEnvelope;
}

/** True when KMS is active and encrypt/decrypt operations are wired. */
export function kmsEnabled(): boolean {
  return config.kms.enabled;
}
