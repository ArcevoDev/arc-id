// src/modules/credentials/flows/verify-credential.flow.test.ts
//
// Phase 0 regression: verification-algorithm mismatch.
// The fix reads the JWT header's `alg` via decodeProtectedHeader() instead of
// hardcoding ES256.  This test signs a credential with real  P-256 keys via
// jose, stores the SPKI bytes in the mock DID record, then verifies the flow
// correctly uses the algorithm from the header to verify.

import { describe, it, expect, vi } from "vitest";

// Mock @/lib/logger to prevent pino-pretty transport from hanging in worker
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  },
}));
vi.mock("@prisma-client", () => ({
  VcFormat: {},
  UserStatus: {},
  MfaType: {},
  AuditLogAction: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

import { generateKeyPair, exportSPKI, SignJWT } from "jose";
import { createMockFlowCtx } from "@/test-utils/mock-db";
import { verifyCredentialFlow } from "./verify-credential.flow";

function derToPem(derBytes: Buffer, type: string): string {
  const b64 = derBytes.toString("base64");
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
}

describe("verifyCredentialFlow — Phase 0: algorithm read from header", () => {
  it("verifies an ES256-signed credential using header alg", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256", {
      extractable: true,
    });

    // Strip PEM armour — DB stores raw DER bytes
    const spkiPem = await exportSPKI(publicKey);
    const rawDer = Buffer.from(
      spkiPem
        .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----/g, "")
        .replace(/[\r\n\s]/g, ""),
      "base64",
    );

    const issuerDid = "did:web:test.arcevocirqle.com.ng";
    const jwt = await new SignJWT({
      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential"],
        issuer: issuerDid,
        credentialSubject: { id: "did:example:alice", degree: "BSc" },
      },
    })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(issuerDid)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue({
      id: issuerDid,
      tenantId: "SYSTEM",
      publicKeyBytes: rawDer,
      keyType: "JsonWebKey2020",
    });

    const result = await verifyCredentialFlow.execute({ credential: jwt }, ctx);

    expect(result.valid).toBe(true);
    expect(result.claims).toBeDefined();
    expect(
      ((result.claims as any)?.vc ?? result.claims)?.credentialSubject?.degree,
    ).toBe("BSc");
  });

  it("rejects a credential with a tampered signature", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256", {
      extractable: true,
    });

    const spkiPem = await exportSPKI(publicKey);
    const rawDer = Buffer.from(
      spkiPem
        .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----/g, "")
        .replace(/[\r\n\s]/g, ""),
      "base64",
    );

    const issuerDid = "did:web:test.arcevocirqle.com.ng";
    const jwt = await new SignJWT({
      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential"],
        issuer: issuerDid,
        credentialSubject: { id: "did:example:alice" },
      },
    })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(issuerDid)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue({
      id: issuerDid,
      tenantId: "SYSTEM",
      publicKeyBytes: rawDer,
      keyType: "JsonWebKey2020",
    });

    const parts = jwt.split(".");
    const tampered = parts[0] + "." + parts[1] + "." + "tampered_sig";
    const result = await verifyCredentialFlow.execute(
      { credential: tampered },
      ctx,
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/signature/i);
  });

  it("returns invalid when credential has no alg header", async () => {
    const header = Buffer.from(JSON.stringify({ typ: "JWT" })).toString(
      "base64url",
    );
    const payload = Buffer.from(
      JSON.stringify({
        iss: "did:web:test.arcevocirqle.com.ng",
        vc: { credentialSubject: {} },
      }),
    ).toString("base64url");
    const noAlgJwt = `${header}.${payload}.fakesig`;

    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue({
      id: "did:web:test.arcevocirqle.com.ng",
      tenantId: "SYSTEM",
      publicKeyBytes: Buffer.from("fake"),
      keyType: "JsonWebKey2020",
    });

    const result = await verifyCredentialFlow.execute(
      { credential: noAlgJwt },
      ctx,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/algorithm/i);
  });
});
