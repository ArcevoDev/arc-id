// src/modules/credentials/flows/offer-credential.flow.test.ts
//
// Flow-level tests for createOfferFlow and createAcceptFlow,
// followed by route-level auth-gate tests for the /offers endpoints.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (must run before vi.mock hoisting) ─────────────────────────

const { mockIssueExecute } = vi.hoisted(() => ({
  mockIssueExecute: vi.fn(),
}));

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
  VcFormat: { JWT: "JWT", LDP: "LDP" },
  UserStatus: {},
  MfaType: {},
  AuditLogAction: {},
  CredentialOfferStatus: {
    PENDING: "PENDING",
    ACCEPTED: "ACCEPTED",
    EXPIRED: "EXPIRED",
    REVOKED: "REVOKED",
  },
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

vi.mock("./issue-credential.flow", () => ({
  issueCredentialFlow: {
    name: "credentials:issue",
    inputSchema: { parse: vi.fn((x: any) => x) },
    execute: mockIssueExecute,
  },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { ApiError } from "@/core/errors";
import { createMockFlowCtx } from "@/test-utils/mock-db";
import { createOfferFlow, createAcceptFlow } from "./offer-credential.flow";

// ── Shared test data ─────────────────────────────────────────────────────────

const validInput = {
  subjectDid: "did:key:z6MktafZzBqy3zNfH1j5RqvMpvKmcxgZ5QYnEpP9cXnvZ1p2",
  holderId: "cusertest000001holder1",
  format: "JWT" as const,
  credentialSubject: { name: "Alice", degree: "BSc" },
  schemaId: "degree-schema-v1",
};

const validOfferRecord = {
  id: "cloffer000001testoffer1",
  token: "550e8400-e29b-41d4-a716-446655440000",
  issuerDid: "did:web:test.arcevocirqle.com.ng",
  subjectDid: validInput.subjectDid,
  holderId: validInput.holderId,
  format: "JWT",
  credentialSubject: { name: "Alice", degree: "BSc" },
  schemaId: "degree-schema-v1",
  credentialExpiresAt: null,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000), // +1h
  status: "PENDING",
  consumed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Flow-level tests: createOfferFlow ───────────────────────────────────────

describe("createOfferFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an offer with valid input", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue({
      id: "did:web:test.arcevocirqle.com.ng",
    });

    const result = await createOfferFlow.execute(validInput, ctx);

    // A UUID token was generated and the offer persisted
    expect(ctx.db.credentialOffer.create).toHaveBeenCalledOnce();
    const createCall = ctx.db.credentialOffer.create.mock.calls[0][0];
    expect(createCall.data.token).toBeDefined();
    expect(createCall.data.issuerDid).toBe("did:web:test.arcevocirqle.com.ng");
    expect(createCall.data.subjectDid).toBe(validInput.subjectDid);
    expect(createCall.data.format).toBe("JWT");
    expect(createCall.data.credentialSubject).toEqual(
      validInput.credentialSubject,
    );
    expect(createCall.data.status).toBe("PENDING");
    expect(createCall.data.consumed).toBe(false);

    // Return shape
    expect(result.token).toBe(createCall.data.token);
    expect(() => new Date(result.expiresAt)).not.toThrow();
  });

  it("throws when tenantId is missing", async () => {
    const ctx = createMockFlowCtx({ tenantId: undefined });

    await expect(
      createOfferFlow.execute(validInput, ctx),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("tenantId"),
    });
  });

  it("throws when tenant DID not found", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(null);

    await expect(
      createOfferFlow.execute(validInput, ctx),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining("DID"),
    });
  });
});

// ─── Flow-level tests: createAcceptFlow ──────────────────────────────────────

describe("createAcceptFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssueExecute.mockReset();
  });

  it("accepts an offer when the user controls the subject DID", async () => {
    mockIssueExecute.mockResolvedValue({
      credentialId: "vc-001",
      credential: { "@context": [], type: ["VerifiableCredential"] },
    });

    const ctx = createMockFlowCtx({
      tenantId: "SYSTEM",
      identityId: "test-user",
    });
    ctx.db.credentialOffer.findUnique.mockResolvedValue(validOfferRecord);
    ctx.db.decentralizedIdentifier.findFirst.mockResolvedValue({
      id: validInput.subjectDid,
    });

    const result = await createAcceptFlow.execute(
      { token: validOfferRecord.token },
      ctx,
    );

    expect(result.credentialId).toBe("vc-001");
    expect(result.credential).toBeDefined();

    // Offer marked accepted
    expect(ctx.db.credentialOffer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: validOfferRecord.id },
        data: { consumed: true, status: "ACCEPTED" },
      }),
    );
  });

  it("throws 404 when offer does not exist", async () => {
    const ctx = createMockFlowCtx({
      tenantId: "SYSTEM",
      identityId: "test-user",
    });
    ctx.db.credentialOffer.findUnique.mockResolvedValue(null);

    await expect(
      createAcceptFlow.execute({ token: "nonexistent-uuid" }, ctx),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining("not found"),
    });
  });

  it("throws 409 when offer is already consumed", async () => {
    const ctx = createMockFlowCtx({
      tenantId: "SYSTEM",
      identityId: "test-user",
    });
    ctx.db.credentialOffer.findUnique.mockResolvedValue({
      ...validOfferRecord,
      consumed: true,
      status: "ACCEPTED",
    });

    await expect(
      createAcceptFlow.execute({ token: validOfferRecord.token }, ctx),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "OFFER_ALREADY_ACCEPTED",
    });
  });

  it("throws 409 when offer has expired", async () => {
    const ctx = createMockFlowCtx({
      tenantId: "SYSTEM",
      identityId: "test-user",
    });
    ctx.db.credentialOffer.findUnique.mockResolvedValue({
      ...validOfferRecord,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000), // -1h
    });

    await expect(
      createAcceptFlow.execute({ token: validOfferRecord.token }, ctx),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "OFFER_EXPIRED",
    });
  });

  it("throws 403 when user does not control the subject DID", async () => {
    const ctx = createMockFlowCtx({
      tenantId: "SYSTEM",
      identityId: "other-user",
    });
    ctx.db.credentialOffer.findUnique.mockResolvedValue(validOfferRecord);
    // findFirst returns null — user's identityId does not match the offer's subjectDid
    ctx.db.decentralizedIdentifier.findFirst.mockResolvedValue(null);

    await expect(
      createAcceptFlow.execute({ token: validOfferRecord.token }, ctx),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("do not control"),
    });
  });
});
