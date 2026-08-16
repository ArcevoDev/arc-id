// src/modules/credentials/flows/revoke-credential.flow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockFindByIdOrThrow, mockUpdateEntry } = vi.hoisted(() => ({
  mockFindByIdOrThrow: vi.fn(),
  mockUpdateEntry: vi.fn(),
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
  VcFormat: { JWT: "JWT", SD_JWT: "SD_JWT", LDP: "LDP" },
  StatusPurpose: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

vi.mock("@/modules/credentials/repositories/credential.repository", () => ({
  CredentialRepository: vi.fn().mockImplementation(function () {
    return { findByIdOrThrow: mockFindByIdOrThrow };
  }),
}));

vi.mock("@/modules/credentials/services/status-list.service", () => ({
  StatusListService: vi.fn().mockImplementation(function () {
    return { updateEntry: mockUpdateEntry };
  }),
}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/webhooks/webhook-dispatcher", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));

import { revokeCredentialFlow } from "./revoke-credential.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

const validInput = { credentialId: "urn:uuid:vc-001" };
const mockCredential = {
  id: "urn:uuid:vc-001",
  issuer: { tenantId: "SYSTEM", id: "did:web:test.arcevocirqle.com.ng" },
  statusListId: "urn:uuid:list-001",
  statusListIndex: 0,
};

describe("revokeCredentialFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByIdOrThrow.mockReset().mockResolvedValue(mockCredential);
    mockUpdateEntry.mockReset().mockResolvedValue(undefined);
  });

  it("revokes a credential with valid input", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });

    await revokeCredentialFlow.execute(validInput, ctx);

    expect(mockFindByIdOrThrow).toHaveBeenCalledWith(validInput.credentialId);
    expect(mockUpdateEntry).toHaveBeenCalledWith(
      mockCredential.statusListId,
      mockCredential.statusListIndex,
      1,
    );
  });

  it("throws 404 when credential is not found", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    mockFindByIdOrThrow.mockRejectedValue(
      Object.assign(new Error("Credential not found"), { statusCode: 404 }),
    );

    await expect(
      revokeCredentialFlow.execute(validInput, ctx),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 404 when credential belongs to a different tenant", async () => {
    const ctx = createMockFlowCtx({ tenantId: "OTHER_TENANT" });

    await expect(
      revokeCredentialFlow.execute(validInput, ctx),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 400 when credential has no status list entry", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    mockFindByIdOrThrow.mockResolvedValue({
      ...mockCredential,
      statusListId: null,
      statusListIndex: null,
    });

    await expect(
      revokeCredentialFlow.execute(validInput, ctx),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("writes audit log on successful revocation", async () => {
    const ctx = createMockFlowCtx({
      tenantId: "SYSTEM",
      identityId: "issuer-id",
    });

    await revokeCredentialFlow.execute(validInput, ctx);

    const { auditService } = await import(
      "@/modules/audit/services/audit.service"
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREDENTIAL_REVOKED" }),
    );
  });

  it("dispatches webhook event on successful revocation", async () => {
    const ctx = createMockFlowCtx({
      tenantId: "SYSTEM",
      identityId: "issuer-id",
    });

    await revokeCredentialFlow.execute(validInput, ctx);

    const { dispatchWebhookEvent } = await import(
      "@/lib/webhooks/webhook-dispatcher"
    );
    expect(dispatchWebhookEvent).toHaveBeenCalledWith(
      ctx.db,
      expect.objectContaining({
        eventType: "CREDENTIAL_REVOKED",
        payload: { credentialId: validInput.credentialId },
      }),
    );
  });

  it("does not crash when audit log write fails", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    const { auditService } = await import(
      "@/modules/audit/services/audit.service"
    );
    (auditService.log as any).mockRejectedValue(new Error("DB error"));

    await expect(
      revokeCredentialFlow.execute(validInput, ctx),
    ).resolves.toBeDefined();
  });

  it("does not crash when webhook dispatch fails", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    const { dispatchWebhookEvent } = await import(
      "@/lib/webhooks/webhook-dispatcher"
    );
    (dispatchWebhookEvent as any).mockRejectedValue(
      new Error("Queue full"),
    );

    await expect(
      revokeCredentialFlow.execute(validInput, ctx),
    ).resolves.toBeDefined();
  });
});
