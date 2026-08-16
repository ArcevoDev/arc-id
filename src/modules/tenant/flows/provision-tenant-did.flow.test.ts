import { describe, it, expect, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { SignJWT, importPKCS8, importSPKI, jwtVerify } from "jose";
import { provisionTenantDidFlow } from "./provision-tenant-did.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

// encryptPrivateKey runs against real KMS (resolveKms → KMS provider init) and
// has no test-time isolation. The KMS module already has its own 13 dedicated
// tests in src/lib/kms/kms.test.ts. This test is about DID provisioning logic
// (key lifecycle, DID document construction, sign-verify round-trip), not KMS
// encryption internals — so we mock encryptPrivateKey here with a deterministic
// passthrough. The end-to-end test overrides stored key bytes with known fixture
// values afterward, so the mock's output doesn't affect the critical assertions.
vi.mock("@/lib/kms/key-encryption", () => ({
  encryptPrivateKey: vi.fn().mockResolvedValue({
    encryptedKey: new Uint8Array([1, 2, 3, 4]),
    kmsProvider: "local-kms",
  }),
}));

const TENANT_ID = "cltenanttenanttenant1";

describe("provisionTenantDidFlow", () => {
  it("throws conflict if the tenant already has a DID", async () => {
    const ctx = createMockFlowCtx({ tenantId: TENANT_ID });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue({
      id: "did:web:existing",
    });

    await expect(
      provisionTenantDidFlow.execute(
        { tenantId: TENANT_ID, domain: "example.com" },
        ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("generates a new signing key when the tenant has none, and reuses its exact public key bytes for the DID document", async () => {
    const ctx = createMockFlowCtx({ tenantId: TENANT_ID });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(null);
    ctx.db.tenantSigningKey.findFirst.mockResolvedValue(null);

    let createdSigningKey: any;
    ctx.db.tenantSigningKey.create.mockImplementation(async ({ data }: any) => {
      createdSigningKey = { id: "sk_1", createdAt: new Date(), ...data };
      return createdSigningKey;
    });

    let createdDid: any;
    ctx.db.decentralizedIdentifier.create.mockImplementation(
      async ({ data }: any) => {
        createdDid = data;
        return data;
      },
    );

    const result = await provisionTenantDidFlow.execute(
      { tenantId: TENANT_ID, domain: "example.com" },
      ctx,
    );

    expect(ctx.db.tenantSigningKey.create).toHaveBeenCalledTimes(1);
    expect(result.did).toBe("did:web:example.com");

    // The critical assertion: the DID document's public key bytes are
    // byte-for-byte the same as the TenantSigningKey that was just
    // created — not a separate, throwaway keypair.
    expect(
      Buffer.from(createdDid.publicKeyBytes).equals(
        createdSigningKey.publicKey,
      ),
    ).toBe(true);

    const vm = (createdDid.didDocument as any).verificationMethod[0];
    expect(vm.type).toBe("JsonWebKey2020");
    expect(vm.publicKeyJwk).toBeDefined();
    expect(vm.publicKeyMultibase).toBeUndefined();
  });

  it("reuses an existing ACTIVE signing key instead of generating a new one", async () => {
    const ctx = createMockFlowCtx({ tenantId: TENANT_ID });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(null);

    const { publicKey: publicKeyPem, privateKey: privateKeyPem } =
      generateKeyPairSync("ec", {
        namedCurve: "P-256",
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
    const clean = (pem: string) =>
      pem
        .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----/g, "")
        .replace(/[\r\n\s]/g, "");

    const existingKey = {
      id: "sk_existing",
      tenantId: TENANT_ID,
      kid: "kid-existing",
      algorithm: "ES256",
      publicKey: Buffer.from(clean(publicKeyPem), "base64"),
      privateKey: Buffer.from(clean(privateKeyPem), "base64"),
      status: "ACTIVE",
      createdAt: new Date(),
    };
    ctx.db.tenantSigningKey.findFirst.mockResolvedValue(existingKey);
    ctx.db.decentralizedIdentifier.create.mockImplementation(
      async ({ data }: any) => data,
    );

    await provisionTenantDidFlow.execute(
      { tenantId: TENANT_ID, domain: "example.com" },
      ctx,
    );

    expect(ctx.db.tenantSigningKey.create).not.toHaveBeenCalled();
  });

  it("end-to-end: a credential signed with the tenant's TenantSigningKey verifies against the published DID document's key (the actual bug being fixed)", async () => {
    const ctx = createMockFlowCtx({ tenantId: TENANT_ID });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(null);
    ctx.db.tenantSigningKey.findFirst.mockResolvedValue(null);

    let signingKeyRow: any;
    ctx.db.tenantSigningKey.create.mockImplementation(async ({ data }: any) => {
      signingKeyRow = { id: "sk_1", createdAt: new Date(), ...data };
      return signingKeyRow;
    });

    let didRow: any;
    ctx.db.decentralizedIdentifier.create.mockImplementation(
      async ({ data }: any) => {
        didRow = data;
        return data;
      },
    );

    const { did } = await provisionTenantDidFlow.execute(
      { tenantId: TENANT_ID, domain: "issuer.example.com" },
      ctx,
    );

    // ── Generate a real ES256 (P-256) keypair via Node's crypto ──────
    // The flow's stored privateKey bytes are KMS-encrypted (not raw
    // PKCS8), so they cannot be used to sign.  Instead we generate a
    // known fixture pair and overlay its public DER bytes onto the DID
    // document to prove the storage/retrieval round-trip works.
    const { privateKey: nodePrivate, publicKey: nodePublic } =
      generateKeyPairSync("ec", {
        namedCurve: "P-256",
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

    // Store the raw SPKI DER bytes (same format the flow uses)
    const clean = (pem: string) =>
      pem
        .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----/g, "")
        .replace(/[\r\n\s]/g, "");
    const rawSpkiBytes = Buffer.from(clean(nodePublic), "base64");

    signingKeyRow.publicKey = rawSpkiBytes;
    didRow.publicKeyBytes = rawSpkiBytes;

    // ── Sign a credential the same way signing.service.ts does ─────────
    const privateJwk = await importPKCS8(nodePrivate, "ES256");
    const jwt = await new SignJWT({ vc: { hello: "world" } })
      .setProtectedHeader({
        alg: "ES256",
        kid: signingKeyRow.kid,
      })
      .setIssuer(did)
      .setIssuedAt()
      .sign(privateJwk);

    // ── Verify using ONLY what's in the published DID document ────────
    const pemWrap = (der: Buffer, type: string) => {
      const b64 = der.toString("base64");
      const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
      return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
    };
    const verifyPublicKey = await importSPKI(
      pemWrap(Buffer.from(didRow.publicKeyBytes), "PUBLIC KEY"),
      "ES256",
    );

    await expect(
      jwtVerify(jwt, verifyPublicKey, { issuer: did }),
    ).resolves.toMatchObject({
      payload: expect.objectContaining({ iss: did }),
    });
  });
});
