// src/modules/oauth/flows/revoke-token-by-id.flow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));

vi.mock("@prisma-client", () => ({
  UserStatus: {},
  AuditLogAction: {},
  VcFormat: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

vi.mock("@/lib/security/jti-blocklist", () => ({
  blockJti: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { revokeTokenByIdFlow } from "./revoke-token-by-id.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";
import { addHours } from "date-fns";

describe("revokeTokenByIdFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revokes a token by id", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    ctx.db.accessToken.findFirst.mockResolvedValue({
      id: "at-1",
      jti: "jti-abc",
      identityId: "identity-1",
      expiresAt: addHours(new Date(), 1),
      revoked: false,
    });
    ctx.db.revokedJti.create.mockResolvedValue({ id: "rj-1" });

    await revokeTokenByIdFlow.execute({ id: "at-1" }, ctx);

    expect(ctx.db.accessToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "at-1" }, data: { revoked: true } }),
    );
  });

  it("throws unauthorized when identityId is missing", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: undefined });

    await expect(
      revokeTokenByIdFlow.execute({ id: "at-1" }, ctx),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws notFound when token does not exist or does not belong to caller", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    ctx.db.accessToken.findFirst.mockResolvedValue(null);

    await expect(
      revokeTokenByIdFlow.execute({ id: "nonexistent" }, ctx),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("is idempotent when token is already revoked", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    ctx.db.accessToken.findFirst.mockResolvedValue({
      id: "at-1",
      jti: "jti-abc",
      identityId: "identity-1",
      expiresAt: addHours(new Date(), 1),
      revoked: true,
    });

    await expect(
      revokeTokenByIdFlow.execute({ id: "at-1" }, ctx),
    ).resolves.toEqual({});

    expect(ctx.db.accessToken.update).not.toHaveBeenCalled();
  });
});
