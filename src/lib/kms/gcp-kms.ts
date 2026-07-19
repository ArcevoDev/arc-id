// src/lib/kms/gcp-kms.ts
//
// FIX: same pattern as aws-kms.ts — construct the module specifier at
// runtime via string concatenation so TypeScript's static resolver skips
// the resolution check for this optional peer dependency.

import type { KmsEnvelope } from "./kms.interface";

async function getKmsClient(): Promise<{ keyManagementServiceClient: any }> {
  try {
    // String concatenation prevents TypeScript from statically resolving
    // the module path — @google-cloud/kms is an optional peer dep.
    const pkg = "@google-cloud" + "/kms";
    const { KeyManagementServiceClient } = await import(pkg);
    const client = new KeyManagementServiceClient();
    return { keyManagementServiceClient: client };
  } catch {
    throw new Error(
      "@google-cloud/kms is not installed. " +
        "Run: pnpm add @google-cloud/kms",
    );
  }
}

export function createGcpKms(keyName: string): KmsEnvelope {
  if (!keyName) {
    throw new Error("GCP_KMS_KEY_NAME is required for GCP KMS mode");
  }

  return {
    provider: "GCP",

    async encrypt(plaintext: Buffer): Promise<Buffer> {
      const { keyManagementServiceClient } = await getKmsClient();
      const [result] = await keyManagementServiceClient.encrypt({
        name: keyName,
        plaintext,
      });
      return Buffer.from(result.ciphertext as Uint8Array);
    },

    async decrypt(ciphertext: Buffer): Promise<Buffer> {
      const { keyManagementServiceClient } = await getKmsClient();
      const [result] = await keyManagementServiceClient.decrypt({
        name: keyName,
        ciphertext,
      });
      return Buffer.from(result.plaintext as Uint8Array);
    },
  };
}
