// src/modules/tenant/flows/provision-tenant-did.flow.ts
//
// Provisions a did:web DID for a tenant.
//
// FIX (was: src/modules/tenant/routes/did.route.ts, inline):
//   The old handler generated a throwaway ES256 keypair, discarded the
//   private half immediately, and stored only the public half on
//   DecentralizedIdentifier.publicKeyBytes. Credential *signing*
//   (signing.service.ts loadSigningKey) uses a completely separate
//   TenantSigningKey row. Those two keypairs have no cryptographic
//   relationship, so any VC issued after DID provisioning failed
//   verification unconditionally — the published DID document's key
//   never matched the key that actually signed anything.
//
// This flow closes that gap: the DID document's verification method
// describes the tenant's real ACTIVE TenantSigningKey. If the tenant has
// no active signing key yet, one is generated here (same ES256 keypair
// generation signing-key.route.ts uses) and reused for both the signing
// key row and the DID document — one keypair, one source of truth.
//
// Also fixes a spec mismatch: the old document used
// type: "JsonWebKey2020" with publicKeyMultibase, which is the wrong
// pairing (JsonWebKey2020 → publicKeyJwk; Multikey/Ed25519VerificationKey2020
// → publicKeyMultibase). This flow uses publicKeyJwk consistently.

import { z } from "zod";
import { randomUUID } from "crypto";
import {
  generateKeyPair,
  exportSPKI,
  exportPKCS8,
  exportJWK,
  importSPKI,
} from "jose";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { ApiError } from "@/core/errors/api-error";
import { encryptPrivateKey } from "@/lib/kms/key-encryption";

const SIGNING_ALGORITHM = "ES256";

export const ProvisionTenantDidInputSchema = z.object({
  tenantId: z.string().cuid(),
  domain: z.string().min(1),
});

export const ProvisionTenantDidOutputSchema = z.object({
  did: z.string(),
  document: z.record(z.string(), z.unknown()),
});

type Input = z.infer<typeof ProvisionTenantDidInputSchema>;
type Output = z.infer<typeof ProvisionTenantDidOutputSchema>;

function pemFromDer(derBase64: string, type: string): string {
  const lines = derBase64.match(/.{1,64}/g)?.join("\n") ?? derBase64;
  return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
}

function cleanBase64FromPem(pem: string): string {
  return pem
    .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----/g, "")
    .replace(/[\r\n\s]/g, "");
}

export const provisionTenantDidFlow: Flow<Input, Output> = {
  name: "tenant:provision-did",
  inputSchema: ProvisionTenantDidInputSchema,
  outputSchema: ProvisionTenantDidOutputSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    const { tenantId, domain } = input;

    // ── 1. Reject if a DID already exists for this tenant ────────────────
    const existing = await ctx.db.decentralizedIdentifier.findUnique({
      where: { tenantId },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.conflict("Tenant already has a DID provisioned");
    }

    // ── 2. Find (or create) the tenant's active signing key ──────────────
    // This is the SAME keypair that signing.service.ts's loadSigningKey
    // will later fetch and sign with — critical for verification to work.
    let signingKey = await ctx.db.tenantSigningKey.findFirst({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    let publicKeySpkiPem: string;

    if (!signingKey) {
      // extractable: true is required — jose's generateKeyPair defaults to
      // non-extractable CryptoKeys, which makes exportPKCS8 throw at
      // runtime ("CryptoKey is not extractable"). We need the raw private
      // key bytes to store in TenantSigningKey, so this must be explicit.
      const { publicKey, privateKey } = await generateKeyPair(
        SIGNING_ALGORITHM,
        {
          extractable: true,
        },
      );
      publicKeySpkiPem = await exportSPKI(publicKey);
      const privateKeyPkcs8Pem = await exportPKCS8(privateKey);
      const kid = randomUUID();

      const { encryptedKey, kmsProvider } = await encryptPrivateKey(
        Buffer.from(cleanBase64FromPem(privateKeyPkcs8Pem), "base64"),
      );

      signingKey = await ctx.db.tenantSigningKey.create({
        data: {
          tenantId,
          kid,
          algorithm: SIGNING_ALGORITHM,
          publicKey: Buffer.from(
            cleanBase64FromPem(publicKeySpkiPem),
            "base64",
          ),
          privateKey: new Uint8Array(encryptedKey),
          kmsProvider,
          status: "ACTIVE",
        },
      });
    } else {
      publicKeySpkiPem = pemFromDer(
        Buffer.from(signingKey.publicKey).toString("base64"),
        "PUBLIC KEY",
      );
    }

    // ── 3. Build did:web + DID document using that SAME key ──────────────
    const did = `did:web:${domain}`;

    const publicKeyLike = await importSPKI(
      publicKeySpkiPem,
      signingKey.algorithm,
    );
    const publicKeyJwk = await exportJWK(publicKeyLike);

    const didDocument = {
      "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/suites/jws-2020/v1",
      ],
      id: did,
      verificationMethod: [
        {
          id: `${did}#${signingKey.kid}`,
          type: "JsonWebKey2020",
          controller: did,
          publicKeyJwk: publicKeyJwk as any, // Cast to prevent nested index signature mismatch
        },
      ],
      authentication: [`${did}#${signingKey.kid}`],
      assertionMethod: [`${did}#${signingKey.kid}`],
    };

    // ── 4. Persist ───────────────────────────────────────────────────────
    const record = await ctx.db.decentralizedIdentifier.create({
      data: {
        id: did,
        tenantId,
        identityId: null,
        publicKeyBytes: signingKey.publicKey,
        keyType: "JsonWebKey2020",
        didDocument: didDocument as any,
      },
    });

    return {
      did: record.id,
      document: record.didDocument as Record<string, unknown>,
    };
  },
};
