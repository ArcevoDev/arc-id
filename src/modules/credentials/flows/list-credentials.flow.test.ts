// src/modules/credentials/flows/list-credentials.flow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@prisma-client", () => ({
  VcFormat: { JWT: "JWT", SD_JWT: "SD_JWT", LDP: "LDP" },
  StatusPurpose: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

const mockFindByHolder = vi.fn();
vi.mock("@/modules/credentials/repositories/credential.repository", () => ({
  CredentialRepository: vi.fn().mockImplementation(function () {
    return { findByHolder: mockFindByHolder };
  }),
}));

import { listCredentialsFlow } from "./list-credentials.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

const mockCredential = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  format: "JWT",
  issuerDid: "did:web:test.arcevocirqle.com.ng",
  subjectDid: "did:key:z6MktafZ",
  issuedAt: new Date("2026-07-22T12:00:00Z"),
  expiresAt: new Date("2027-07-22T12:00:00Z"),
  createdAt: new Date("2026-07-22T12:00:00Z"),
  credentialSubject: { name: "Alice" },
  issuer: { id: "did:web:test.arcevocirqle.com.ng", tenantId: "SYSTEM" },
  ...overrides,
});

describe("listCredentialsFlow", () => {
  const identityId = "test-identity-001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns credentials held by the caller's identity", async () => {
    const mockCreds = [
      mockCredential("vc-001"),
      mockCredential("vc-002", {
        credentialSubject: { name: "Bob" },
      }),
    ];
    mockFindByHolder.mockResolvedValue(mockCreds);

    const ctx = createMockFlowCtx({ identityId });
    const result = (await listCredentialsFlow.execute({}, ctx)) as any[];

    expect(mockFindByHolder).toHaveBeenCalledWith(identityId);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "vc-001",
      format: "JWT",
      issuerDid: "did:web:test.arcevocirqle.com.ng",
    });
    expect(result[1].id).toBe("vc-002");
  });

  it("returns empty array when identity has no credentials", async () => {
    mockFindByHolder.mockResolvedValue([]);

    const ctx = createMockFlowCtx({ identityId });
    const result = await listCredentialsFlow.execute({}, ctx);

    expect(result).toEqual([]);
  });

  it("presents credentials via presentCredential shape", async () => {
    const raw = mockCredential("vc-003", {
      format: "LDP",
      credentialSubject: { name: "Charlie", email: "charlie@test.com" },
    });
    mockFindByHolder.mockResolvedValue([raw]);

    const ctx = createMockFlowCtx({ identityId });
    const result = await listCredentialsFlow.execute({}, ctx);

    expect(result[0]).toEqual({
      id: "vc-003",
      format: "LDP",
      issuerDid: "did:web:test.arcevocirqle.com.ng",
      subjectDid: "did:key:z6MktafZ",
      issuedAt: raw.issuedAt,
      expiresAt: raw.expiresAt,
      createdAt: raw.createdAt.toISOString(),
      credentialSubject: { name: "Charlie", email: "charlie@test.com" },
    });
  });

  it("handles identityId being undefined gracefully", async () => {
    mockFindByHolder.mockResolvedValue([]);

    const ctx = createMockFlowCtx({ identityId: undefined });
    const result = await listCredentialsFlow.execute({}, ctx);

    expect(mockFindByHolder).toHaveBeenCalledWith("");
    expect(result).toEqual([]);
  });
});
