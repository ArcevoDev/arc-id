// src/modules/auth/flows/switch-context.flow.test.ts
//
// Proves the context-switch flow:
//   - Issues tenant-scoped tokens after validating membership + session
//   - Throws 401 without identity or session
//   - Throws 403 when not a member of the target tenant
//   - Throws 409 on concurrent token rotation (revokeCount === 0)

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@prisma-client", () => ({
  UserStatus: {},
  MfaType: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
}));

vi.mock("@/lib/security/jti-blocklist", () => ({
  blockJti: vi.fn().mockResolvedValue(undefined),
  revokeJti: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

const mockTokenIssue = vi.fn();
vi.mock("@/modules/oauth/services/token.service", () => ({
  TokenService: vi.fn().mockImplementation(function () {
    return { issue: mockTokenIssue };
  }),
}));

import { switchContextFlow } from "./switch-context.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

const IDENTITY_ID = "identity-1";
const SESSION_ID = "s".repeat(40);
const TENANT_ID = "cltenant000001testtenant1";
const mockTokenBundle = {
  accessToken: "at-scoped",
  refreshToken: "rt-scoped",
  idToken: null,
  expiresIn: 3600,
};

function setupHappy(ctx: ReturnType<typeof createMockFlowCtx>) {
  ctx.db.tenantMembership.findFirst.mockResolvedValue({
    role: { name: "ADMIN" },
  });
  ctx.db.session.findFirst.mockResolvedValue({
    id: SESSION_ID,
    identityId: IDENTITY_ID,
    refreshTokenId: "rt-1",
    authLevel: "aal1",
  });
  ctx.db.refreshToken.updateMany.mockResolvedValue({ count: 1 });
  ctx.db.accessToken.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTokenIssue.mockReset().mockResolvedValue(mockTokenBundle);
});

describe("switchContextFlow — tenant-scoped token issuance", () => {
  it("issues tenant-scoped tokens on valid context switch", async () => {
    const ctx = createMockFlowCtx({
      identityId: IDENTITY_ID,
      sessionId: SESSION_ID,
    });
    setupHappy(ctx);

    const result = await switchContextFlow.execute(
      { tenantId: TENANT_ID },
      ctx,
    );

    expect(result).toMatchObject(mockTokenBundle);
    expect(ctx.db.tenantMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { identityId: IDENTITY_ID, tenantId: TENANT_ID, status: "ACTIVE" },
      }),
    );
    expect(mockTokenIssue).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        identityId: IDENTITY_ID,
        tenantId: TENANT_ID,
        sessionId: SESSION_ID,
      }),
    );
  });

  it("throws 401 when identityId is missing", async () => {
    const ctx = createMockFlowCtx({ sessionId: SESSION_ID });
    // identityId intentionally undefined

    await expect(
      switchContextFlow.execute({ tenantId: TENANT_ID }, ctx),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(ctx.db.tenantMembership.findFirst).not.toHaveBeenCalled();
  });

  it("throws 403 when not a member of target tenant", async () => {
    const ctx = createMockFlowCtx({
      identityId: IDENTITY_ID,
      sessionId: SESSION_ID,
    });
    ctx.db.tenantMembership.findFirst.mockResolvedValue(null);

    await expect(
      switchContextFlow.execute({ tenantId: TENANT_ID }, ctx),
    ).rejects.toMatchObject({ statusCode: 403, message: /No access/i });

    expect(ctx.db.session.findFirst).not.toHaveBeenCalled();
  });

  it("throws 409 when concurrent request already rotated the refresh token", async () => {
    const ctx = createMockFlowCtx({
      identityId: IDENTITY_ID,
      sessionId: SESSION_ID,
    });
    ctx.db.tenantMembership.findFirst.mockResolvedValue({
      role: { name: "ADMIN" },
    });
    ctx.db.session.findFirst.mockResolvedValue({
      id: SESSION_ID,
      identityId: IDENTITY_ID,
      refreshTokenId: "rt-1",
      authLevel: "aal1",
    });
    // accessToken.findMany runs before the refresh-token race check
    ctx.db.accessToken.findMany.mockResolvedValue([]);
    // 0 rows updated → concurrent rotation detected
    ctx.db.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      switchContextFlow.execute({ tenantId: TENANT_ID }, ctx),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: /concurrent session mutation/i,
    });
  });

  it("throws 401 when session is not found or expired", async () => {
    const ctx = createMockFlowCtx({
      identityId: IDENTITY_ID,
      sessionId: SESSION_ID,
    });
    ctx.db.tenantMembership.findFirst.mockResolvedValue({
      role: { name: "ADMIN" },
    });
    ctx.db.session.findFirst.mockResolvedValue(null);

    await expect(
      switchContextFlow.execute({ tenantId: TENANT_ID }, ctx),
    ).rejects.toMatchObject({ statusCode: 401, message: /not found or expired/i });
  });
});
