// src/modules/auth/flows/mfa-verify.flow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));

vi.mock("@prisma-client", () => ({
  UserStatus: {},
  MfaType: { TOTP: "TOTP" },
  AuditLogAction: {},
  VcFormat: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));
vi.mock("@/api/plugins/jwt.plugin", () => ({ resolvePemContent: vi.fn(() => "") }));
vi.mock("@/core/db", () => ({ prisma: {} }));

const mockVerifyTotp = vi.fn();
const mockPromoteToAal2 = vi.fn();
const mockTokenIssue = vi.fn();
vi.mock("../services/mfa.service", () => ({
  MfaService: vi.fn().mockImplementation(function () {
    return { verifyTotp: mockVerifyTotp };
  }),
}));
vi.mock("../services/session.service", () => ({
  SessionService: vi.fn().mockImplementation(function () {
    return { promoteToAal2: mockPromoteToAal2 };
  }),
}));
vi.mock("@/modules/oauth/services/token.service", () => ({
  TokenService: vi.fn().mockImplementation(function () {
    return { issue: mockTokenIssue };
  }),
}));
vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { mfaVerifyFlow } from "./mfa-verify.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

describe("mfaVerifyFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyTotp.mockReset().mockReturnValue(true);
    mockPromoteToAal2.mockReset().mockResolvedValue(undefined);
    mockTokenIssue.mockReset().mockResolvedValue({ accessToken: "at-1", refreshToken: "rt-1", idToken: null, expiresIn: 3600 });
  });

  it("verifies MFA code and promotes session to aal2", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.session.findUnique.mockResolvedValue({
      id: "session-1",
      valid: true,
      identityId: "identity-1",
      identity: { id: "identity-1" },
    });
    ctx.db.mfa.findFirst.mockResolvedValue({ secret: "JBSWY3DPEHPK3PXP" });

    const result = await mfaVerifyFlow.execute({ sessionId: "session-1", code: "123456" }, ctx);

    expect(mockVerifyTotp).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP", "123456");
    expect(mockPromoteToAal2).toHaveBeenCalledWith("session-1");
    expect(result).toMatchObject({ authLevel: "aal2", sessionId: "session-1", accessToken: "at-1" });
  });

  it("throws notFound when session does not exist", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.session.findUnique.mockResolvedValue(null);

    await expect(
      mfaVerifyFlow.execute({ sessionId: "session-nonexistent", code: "123456" }, ctx),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws unauthorized when session is invalid", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.session.findUnique.mockResolvedValue({ id: "session-1", valid: false, identityId: "identity-1", identity: {} });

    await expect(
      mfaVerifyFlow.execute({ sessionId: "session-1", code: "123456" }, ctx),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws badRequest when no active MFA configuration", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.session.findUnique.mockResolvedValue({ id: "session-1", valid: true, identityId: "identity-1", identity: {} });
    ctx.db.mfa.findFirst.mockResolvedValue(null);

    await expect(
      mfaVerifyFlow.execute({ sessionId: "session-1", code: "123456" }, ctx),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws unauthorized when TOTP code is wrong", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.session.findUnique.mockResolvedValue({ id: "session-1", valid: true, identityId: "identity-1", identity: {} });
    ctx.db.mfa.findFirst.mockResolvedValue({ secret: "JBSWY3DPEHPK3PXP" });
    mockVerifyTotp.mockReturnValue(false);

    await expect(
      mfaVerifyFlow.execute({ sessionId: "session-1", code: "000000" }, ctx),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
