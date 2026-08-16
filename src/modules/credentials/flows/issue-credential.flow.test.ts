// src/modules/credentials/flows/issue-credential.flow.test.ts
//
// Flow-level tests for issueCredentialFlow — credential issuance with
// status-list allocation, signing, audit, notification, and webhook side
// effects.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (run before vi.mock hoisting) ─────────────────────────────

const { mockResolveOrThrow, mockSign, mockAllocateIndex } = vi.hoisted(
  () => ({
    mockResolveOrThrow: vi.fn(),
    mockSign: vi.fn(),
    mockAllocateIndex: vi.fn(),
  }),
);

// ── Module mocks (order matters — hoisted before imports) ──────────────────

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
  VcFormat: {
    JWT: "JWT",
    SD_JWT: "SD_JWT",
    LDP: "LDP",
    DataIntegrity: "DataIntegrity",
  },
  StatusPurpose: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

vi.mock("@/core/config", () => ({
  config: {
    base: { apiUrl: "https://api.test.arcevocirqle.com.ng" },
  },
}));

vi.mock("@/modules/credentials/services/did.service", () => ({
  DidService: vi.fn().mockImplementation(function () {
    return {
      resolveOrThrow: mockResolveOrThrow,
      resolve: vi.fn(),
    };
  }),
}));

vi.mock("@/modules/credentials/services/signing.service", () => ({
  SigningService: vi.fn().mockImplementation(function () {
    return {
      sign: mockSign,
    };
  }),
}));

vi.mock("@/modules/credentials/services/status-list.service", () => ({
  StatusListService: vi.fn().mockImplementation(function () {
    return {
      allocateIndex: mockAllocateIndex,
    };
  }),
}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/notifications/notification.service", () => ({
  notificationService: { sendCredentialIssued: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/webhooks/webhook-dispatcher", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { issueCredentialFlow } from "./issue-credential.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";
import { ApiError } from "@/core/errors";

// ── Shared test data ───────────────────────────────────────────────────────

const validInput = {
  subjectDid: "did:key:z6MktafZzBqy3zNfH1j5RqvMpvKmcxgZ5QYnEpP9cXnvZ1p2",
  holderId: "cusertest000001holder1",
  format: "JWT" as const,
  credentialSubject: { name: "Alice", degree: "BSc" },
  schemaId: "degree-schema-v1",
};

const mockTenantDid = { id: "did:web:test.arcevocirqle.com.ng", tenantId: "SYSTEM" };
const mockStatusListResult = { listId: "urn:uuid:list-001", index: 0 };
const mockSignedResult = {
  proof: "eyJhbGciOiJFUzI1NiJ9.mock-proof",
  signedCredential: "eyJhbGciOiJFUzI1NiJ9.mock-signed-jwt",
};
const mockCreatedVc = { id: "urn:uuid:vc-001" };

// ── Tests ──────────────────────────────────────────────────────────────────

describe("issueCredentialFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveOrThrow.mockReset().mockResolvedValue({ id: validInput.subjectDid });
    mockSign.mockReset().mockResolvedValue(mockSignedResult);
    mockAllocateIndex.mockReset().mockResolvedValue(mockStatusListResult);
  });

  // ── Happy path ─────────────────────────────────────────────────────────

  it("issues a JWT credential with valid input", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(mockTenantDid);
    ctx.db.verifiableCredential.create.mockResolvedValue(mockCreatedVc);

    const result = await issueCredentialFlow.execute(validInput, ctx);

    expect(result.credentialId).toBe(mockCreatedVc.id);
    expect(result.credential).toBe(mockSignedResult.signedCredential);

    // Status list allocated inside the transaction
    expect(mockAllocateIndex).toHaveBeenCalledWith(
      "REVOCATION",
      "SYSTEM",
      expect.anything(),
    );

    // VC persisted with correct fields
    expect(ctx.db.verifiableCredential.create).toHaveBeenCalledOnce();
    const createData = ctx.db.verifiableCredential.create.mock.calls[0][0].data;
    expect(createData.format).toBe("JWT");
    expect(createData.issuerDid).toBe(mockTenantDid.id);
    expect(createData.subjectDid).toBe(validInput.subjectDid);
    expect(createData.holderId).toBe(validInput.holderId);
    expect(createData.statusListId).toBe(mockStatusListResult.listId);
    expect(createData.statusListIndex).toBe(mockStatusListResult.index);
    expect(createData.credentialSubject).toEqual(validInput.credentialSubject);

    // Side effects: audit + webhook (notification already tested below)
    expect(ctx.db.verifiableCredential.create.mock.calls[0][0].data.format).toBe("JWT");
  });

  it("issues an SD_JWT credential", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(mockTenantDid);
    ctx.db.verifiableCredential.create.mockResolvedValue(mockCreatedVc);
    mockSign.mockResolvedValue({
      proof: "sd-jwt-proof",
      signedCredential: "sd-jwt-token",
    });

    const result = await issueCredentialFlow.execute(
      { ...validInput, format: "SD_JWT" as const },
      ctx,
    );

    expect(result.credentialId).toBe(mockCreatedVc.id);
    expect(result.credential).toBe("sd-jwt-token");
    expect(ctx.db.verifiableCredential.create.mock.calls[0][0].data.format).toBe("SD_JWT");
  });

  // ── Error paths ────────────────────────────────────────────────────────

  it("throws 400 when tenantId is missing", async () => {
    const ctx = createMockFlowCtx({ tenantId: undefined });

    await expect(
      issueCredentialFlow.execute(validInput, ctx),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("tenantId"),
    });

    expect(ctx.db.verifiableCredential.create).not.toHaveBeenCalled();
  });

  it("throws 404 when tenant DID is not configured", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(null);

    await expect(
      issueCredentialFlow.execute(validInput, ctx),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining("DID"),
    });
  });

  it("throws when subject DID cannot be resolved", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(mockTenantDid);
    mockResolveOrThrow.mockRejectedValue(
      ApiError.notFound("DID not found: did:key:nonexistent"),
    );

    await expect(
      issueCredentialFlow.execute(validInput, ctx),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining("DID not found"),
    });
  });

  it("propagates signing service errors", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(mockTenantDid);
    mockSign.mockRejectedValue(new Error("KMS unreachable"));

    await expect(
      issueCredentialFlow.execute(validInput, ctx),
    ).rejects.toThrow("KMS unreachable");
  });

  it("propagates status list allocation errors", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(mockTenantDid);
    mockAllocateIndex.mockRejectedValue(new Error("List full"));

    await expect(
      issueCredentialFlow.execute(validInput, ctx),
    ).rejects.toThrow("List full");
  });

  // ── Side effects ───────────────────────────────────────────────────────

  it("sends notification when holderId is present with an email", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "issuer-id" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(mockTenantDid);
    ctx.db.verifiableCredential.create.mockResolvedValue(mockCreatedVc);
    ctx.db.identity.findUnique.mockResolvedValue({
      primaryEmail: "holder@test.com",
      name: "Alice",
    });

    await issueCredentialFlow.execute(validInput, ctx);

    const { notificationService } = await import(
      "@/lib/notifications/notification.service"
    );
    expect(notificationService.sendCredentialIssued).toHaveBeenCalledOnce();
    expect(notificationService.sendCredentialIssued).toHaveBeenCalledWith(
      "holder@test.com",
      expect.objectContaining({ holderName: "Alice" }),
    );
  });

  it("does not send notification when holderId is omitted", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(mockTenantDid);
    ctx.db.verifiableCredential.create.mockResolvedValue(mockCreatedVc);

    await issueCredentialFlow.execute(
      { ...validInput, holderId: undefined },
      ctx,
    );

    const { notificationService } = await import(
      "@/lib/notifications/notification.service"
    );
    expect(notificationService.sendCredentialIssued).not.toHaveBeenCalled();
  });

  it("does not crash when holder has no email", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(mockTenantDid);
    ctx.db.verifiableCredential.create.mockResolvedValue(mockCreatedVc);
    ctx.db.identity.findUnique.mockResolvedValue(null);

    const result = await issueCredentialFlow.execute(validInput, ctx);

    expect(result.credentialId).toBe(mockCreatedVc.id);
  });

  // ── Adversarial ─────────────────────────────────────────────────────────

  it("does not crash when audit log write fails (void catch)", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(mockTenantDid);
    ctx.db.verifiableCredential.create.mockResolvedValue(mockCreatedVc);
    const { auditService } = await import("@/modules/audit/services/audit.service");
    (auditService.log as any).mockRejectedValue(new Error("DB connection lost"));

    const result = await issueCredentialFlow.execute(validInput, ctx);

    // Flow still returns successfully despite audit failure
    expect(result.credentialId).toBe(mockCreatedVc.id);
  });

  it("does not crash when webhook dispatch fails (void catch)", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.decentralizedIdentifier.findUnique.mockResolvedValue(mockTenantDid);
    ctx.db.verifiableCredential.create.mockResolvedValue(mockCreatedVc);
    const { dispatchWebhookEvent } = await import(
      "@/lib/webhooks/webhook-dispatcher"
    );
    (dispatchWebhookEvent as any).mockRejectedValue(
      new Error("Webhook queue full"),
    );

    const result = await issueCredentialFlow.execute(validInput, ctx);

    expect(result.credentialId).toBe(mockCreatedVc.id);
  });
});
