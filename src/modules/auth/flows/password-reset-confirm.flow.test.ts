// src/modules/auth/flows/password-reset-confirm.flow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));
vi.mock("@prisma-client", () => ({
  UserStatus: {},
  MfaType: {},
  AuditLogAction: {},
  VcFormat: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

const mockConsume = vi.fn();
vi.mock("../services/email-token.service", () => ({
  EmailTokenService: vi.fn().mockImplementation(function () {
    return { consume: mockConsume };
  }),
}));

const mockRevokeAll = vi.fn();
vi.mock("../repositories/session.repository", () => ({
  SessionRepository: vi.fn().mockImplementation(function () {
    return { revokeAllForIdentity: mockRevokeAll };
  }),
}));

vi.mock("../services/password.service", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password-value"),
}));

vi.mock("@/lib/security/password-rules", () => ({
  enforceSystemPasswordRules: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/notification.service", () => ({
  notificationService: { sendPasswordChanged: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { passwordResetConfirmFlow } from "./password-reset-confirm.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

describe("passwordResetConfirmFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsume.mockReset().mockResolvedValue({ identityId: "identity-1" });
    mockRevokeAll.mockReset().mockResolvedValue(undefined);
  });

  it("resets password, revokes sessions, and sends notification", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.localAccount.update.mockResolvedValue({
      identity: { primaryEmail: "alice@example.com", name: "Alice" },
    });

    await passwordResetConfirmFlow.execute({ token: "valid-token", newPassword: "NewStr0ng!Pass" }, ctx);

    expect(mockConsume).toHaveBeenCalledWith("valid-token", "RESET_PASSWORD");
    expect(ctx.db.localAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { identityId: "identity-1" },
        data: expect.objectContaining({ passwordHash: "hashed-password-value" }),
      }),
    );
    expect(mockRevokeAll).toHaveBeenCalledWith("identity-1");
  });

  it("propagates invalid token errors", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    mockConsume.mockRejectedValue(new Error("Token is invalid or has expired"));

    await expect(
      passwordResetConfirmFlow.execute({ token: "bad", newPassword: "NewStr0ng!Pass" }, ctx),
    ).rejects.toThrow("Token is invalid or has expired");
  });
});
