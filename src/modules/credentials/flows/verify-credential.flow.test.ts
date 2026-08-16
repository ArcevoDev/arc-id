// src/modules/credentials/flows/verify-credential.flow.test.ts
//
// Phase 0 regression: verification-algorithm mismatch.
// The fix reads the JWT header's `alg` via decodeProtectedHeader() instead of
// hardcoding ES256.  This test signs a credential with real  P-256 keys via
// jose, stores the SPKI bytes in the mock DID record, then verifies the flow
// correctly uses the algorithm from the header to verify.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock node:dns/promises before any imports — url-safety.ts imports it
// at module scope, and the did:web path in verify-credential.flow calls
// assertSafeUrl which resolves the hostname to check for SSRF rebinding.
vi.mock("node:dns/promises", () => ({
  default: {
    resolve4: vi.fn(),
    resolve6: vi.fn(),
  },
}));

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

// DidService and StatusListService are mocked at module level so the flow
// test focuses on verify-credential logic (signature/expiry/revocation)
// rather than their internal DB access — both have their own dedicated test
// coverage elsewhere (issue-credential.flow.test.ts, status-list.service.test.ts).
const { mockDidServiceResolve, mockStatusListCheckEntry } = vi.hoisted(() => ({
  mockDidServiceResolve: vi.fn(),
  mockStatusListCheckEntry: vi.fn(),
}));
vi.mock("@/modules/credentials/services/did.service", () => ({
  DidService: vi.fn().mockImplementation(function () {
    return { resolve: mockDidServiceResolve };
  }),
}));
vi.mock("@/modules/credentials/services/status-list.service", () => ({
  StatusListService: vi.fn().mockImplementation(function () {
    return { checkEntry: mockStatusListCheckEntry };
  }),
}));

import dns from "node:dns/promises";
import { generateKeyPair, exportSPKI, SignJWT } from "jose";
import { createMockFlowCtx } from "@/test-utils/mock-db";
import { verifyCredentialFlow } from "./verify-credential.flow";

const mockResolve4 = dns.resolve4 as unknown as ReturnType<typeof vi.fn>;
const mockResolve6 = dns.resolve6 as unknown as ReturnType<typeof vi.fn>;

function derToPem(derBytes: Buffer, type: string): string {
  const b64 = derBytes.toString("base64");
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
}

describe("verifyCredentialFlow — Phase 0: algorithm read from header", () => {
  beforeEach(() => {
    mockResolve4.mockReset();
    mockResolve6.mockReset();
    mockResolve6.mockRejectedValue(new Error("ENOTFOUND"));
  });

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
    mockDidServiceResolve.mockResolvedValue({
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
    mockDidServiceResolve.mockResolvedValue({
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
    mockDidServiceResolve.mockResolvedValue({
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

  it("REGRESSION: rejects a did:web credential whose hostname resolves to a private IP (SSRF via DNS rebinding)", async () => {
    // Trigger the external-DID (did:web) branch by returning null from
    // DidService.resolve — the flow then builds a JWKS URL from the DID's
    // domain and calls assertSafeUrl() / createRemoteJWKSet on it.
    mockDidServiceResolve.mockResolvedValue(null);

    // Simulate a hostname that resolves to an AWS IMDS endpoint — the
    // standard SSRF-via-DNS-rebinding attack that created the need for
    // assertSafeUrl's DNS-resolution check.
    mockResolve4.mockResolvedValue(["169.254.169.254"]);

    const credential = [
      "eyJhbGciOiJFUzI1NiJ9", // {"alg":"ES256"}
      Buffer.from(
        JSON.stringify({
          iss: "did:web:attacker-private.example.com",
          vc: { credentialSubject: {} },
        }),
      ).toString("base64url"),
      "fakesig", // won't get this far — assertSafeUrl throws first
    ].join(".");

    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });

    const result = await verifyCredentialFlow.execute(
      { credential },
      ctx,
    );

    expect(result.valid).toBe(false);
    // The reason comes through the catch handler as error.code === "BAD_REQUEST"
    // (ApiError.badRequest).  We don't match the exact message because the
    // important thing is that it's rejected — the flow's catch converts it.
    expect(result.reason).toBeDefined();
    // Confirm DNS resolution was actually queried (i.e. the did:web path ran)
    expect(mockResolve4).toHaveBeenCalledWith("attacker-private.example.com");
  });
});
