// src/modules/oauth/flows/token-revoke.flow.test.ts
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

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/security/jti-blocklist", () => ({
  blockJti: vi.fn().mockResolvedValue(undefined),
}));

import { tokenRevokeFlow } from "./token-revoke.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";
import { addHours } from "date-fns";

describe("tokenRevokeFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revokes an access token by raw token value", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    ctx.db.accessToken.findFirst.mockResolvedValue({
      id: "at-1",
      jti: "jti-abc",
      identityId: "identity-1",
      expiresAt: addHours(new Date(), 1),
    });
    ctx.db.revokedJti.create.mockResolvedValue({ id: "rj-1" });

    await tokenRevokeFlow.execute({ token: "raw-access-token-value" }, ctx);

    expect(ctx.db.accessToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "at-1" }, data: { revoked: true } }),
    );
    expect(ctx.db.revokedJti.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ jti: "jti-abc" }) }),
    );
  });

  it("revokes a refresh token by raw token value", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    ctx.db.accessToken.findFirst.mockResolvedValue(null);
    ctx.db.refreshToken.findFirst.mockResolvedValue({
      id: "rt-1",
      identityId: "identity-1",
    });

    await tokenRevokeFlow.execute({ token: "raw-refresh-token-value" }, ctx);

    expect(ctx.db.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "rt-1" }, data: { revoked: true } }),
    );
  });

  it("is idempotent when token does not exist", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    ctx.db.accessToken.findFirst.mockResolvedValue(null);
    ctx.db.refreshToken.findFirst.mockResolvedValue(null);

    await expect(
      tokenRevokeFlow.execute({ token: "nonexistent" }, ctx),
    ).resolves.toEqual({});
  });

  it("is idempotent when access token has no jti", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    ctx.db.accessToken.findFirst.mockResolvedValue({
      id: "at-1",
      jti: null,
      identityId: "identity-1",
      expiresAt: addHours(new Date(), 1),
    });

    await expect(
      tokenRevokeFlow.execute({ token: "no-jti-token" }, ctx),
    ).resolves.toEqual({});
    // No JTI operations on null jti
    expect(ctx.db.revokedJti.create).not.toHaveBeenCalled();
  });

  it("does not crash when blockJti fails (void catch)", async () => {
    const { blockJti } = await import("@/lib/security/jti-blocklist");
    (blockJti as any).mockRejectedValue(new Error("Redis unreachable"));

    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    ctx.db.accessToken.findFirst.mockResolvedValue({
      id: "at-1",
      jti: "jti-abc",
      identityId: "identity-1",
      expiresAt: addHours(new Date(), 1),
    });
    ctx.db.revokedJti.create.mockResolvedValue({ id: "rj-1" });

    await expect(
      tokenRevokeFlow.execute({ token: "raw-access-token-value" }, ctx),
    ).resolves.toEqual({});
  });
});
