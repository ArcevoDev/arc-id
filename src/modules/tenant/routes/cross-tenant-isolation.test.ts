// src/modules/tenant/routes/cross-tenant-isolation.test.ts
//
// PROVES cross-tenant isolation:
//   Tenant A cannot read/write Tenant B's data.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { revokeCredentialFlow } from "@/modules/credentials/flows/revoke-credential.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

const TENANT_A = "cltenant000001aaaaa";
const TENANT_B = "cltenant000002bbbbb";

const mockDb = vi.hoisted(() => {
  const m: Record<string, any> = {};
  m.verifiableCredential = { findUnique: vi.fn() };
  m.bitstringStatusList = {
    update: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  };
  m.statusListEntry = {
    upsert: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  };
  m.auditLog = { create: vi.fn().mockResolvedValue({}) };
  m.$transaction = vi.fn(async (fn: (tx: any) => any) => fn(m));
  return m;
});

vi.mock("@/core/db", () => ({ prisma: mockDb }));

describe("Cross-tenant isolation — credential revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.bitstringStatusList.update.mockResolvedValue({});
    mockDb.bitstringStatusList.findUniqueOrThrow.mockResolvedValue({
      id: "sl-1",
      statusPurpose: "REVOCATION",
      maxSize: 131072,
      encodedList: Buffer.alloc(16384, 0),
    });
    mockDb.statusListEntry.upsert.mockResolvedValue({});
    mockDb.statusListEntry.findMany.mockResolvedValue([]);
  });

  it("TENANT_A credential rejected when revoked by MEMBER_B", async () => {
    mockDb.verifiableCredential.findUnique.mockResolvedValue({
      id: "urn:uuid:vc-123",
      issuer: { tenantId: TENANT_A },
      statusListId: "sl-1",
      statusListIndex: 5,
    });

    const ctx = createMockFlowCtx({
      identityId: "member-b",
      tenantId: TENANT_B,
      db: mockDb as any,
    });

    await expect(
      revokeCredentialFlow.execute({ credentialId: "urn:uuid:vc-123" }, ctx),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("TENANT_A credential CAN be revoked by MEMBER_A", async () => {
    mockDb.verifiableCredential.findUnique.mockResolvedValue({
      id: "urn:uuid:vc-123",
      issuer: { tenantId: TENANT_A },
      statusListId: "sl-1",
      statusListIndex: 5,
    });

    const ctx = createMockFlowCtx({
      identityId: "member-a",
      tenantId: TENANT_A,
      db: mockDb as any,
    });

    const result = await revokeCredentialFlow.execute({ credentialId: "urn:uuid:vc-123" }, ctx);
    expect(result).toEqual({});
  });

  it("identity-owned credential (issuer.tenantId: null) bypasses tenant check", async () => {
    mockDb.verifiableCredential.findUnique.mockResolvedValue({
      id: "urn:uuid:vc-owned",
      issuer: { tenantId: null },
      statusListId: "sl-2",
      statusListIndex: 3,
    });

    const ctx = createMockFlowCtx({
      identityId: "member-a",
      tenantId: TENANT_A,
      db: mockDb as any,
    });

    const result = await revokeCredentialFlow.execute(
      { credentialId: "urn:uuid:vc-owned" }, ctx,
    );
    expect(result).toEqual({});
  });
});
