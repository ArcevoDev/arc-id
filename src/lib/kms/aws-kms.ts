// src/lib/kms/aws-kms.ts
//
// FIX: TypeScript (with moduleResolution: NodeNext) statically resolves
// every import() expression — even dynamic ones inside try/catch — and
// fails with TS2307 if the package isn't in node_modules.
//
// @aws-sdk/client-kms is an OPTIONAL peer dependency: users who deploy
// with KMS_PROVIDER=AWS must install it; everyone else doesn't need it.
// We prevent TypeScript's static resolver from touching this import by
// constructing the module specifier at runtime via string concatenation.
// TypeScript cannot fold "A" + "B" into a resolvable module path, so it
// skips the resolution check entirely. Runtime behaviour is identical.

import type { KmsEnvelope } from "./kms.interface";

async function getKmsClient(): Promise<any> {
  try {
    // String concatenation prevents TypeScript from statically resolving
    // the module path — @aws-sdk/client-kms is an optional peer dep.
    const pkg = "@aws-sdk" + "/client-kms";
    const { KMSClient, EncryptCommand, DecryptCommand } = await import(pkg);
    const client = new KMSClient({});
    return { client, EncryptCommand, DecryptCommand };
  } catch {
    throw new Error(
      "@aws-sdk/client-kms is not installed. " +
        "Run: pnpm add @aws-sdk/client-kms",
    );
  }
}

export function createAwsKms(keyId: string): KmsEnvelope {
  if (!keyId) {
    throw new Error("AWS_KMS_KEY_ID is required for AWS KMS mode");
  }

  return {
    provider: "AWS",

    async encrypt(plaintext: Buffer): Promise<Buffer> {
      const { client, EncryptCommand } = await getKmsClient();
      const cmd = new EncryptCommand({ KeyId: keyId, Plaintext: plaintext });
      const resp = await client.send(cmd);
      return Buffer.from(resp.CiphertextBlob as Uint8Array);
    },

    async decrypt(ciphertext: Buffer): Promise<Buffer> {
      const { client, DecryptCommand } = await getKmsClient();
      const cmd = new DecryptCommand({
        KeyId: keyId,
        CiphertextBlob: ciphertext,
      });
      const resp = await client.send(cmd);
      return Buffer.from(resp.Plaintext as Uint8Array);
    },
  };
}
