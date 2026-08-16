// src/modules/auth/flows/email-verify.flow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));
vi.mock("@prisma-client", () => ({
  UserStatus: { ACTIVE: "ACTIVE" },
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

vi.mock("@/lib/notifications/notification.service", () => ({
  notificationService: { sendWelcome: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { emailVerifyFlow } from "./email-verify.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

describe("emailVerifyFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsume.mockReset().mockResolvedValue({ identityId: "identity-1" });
  });

  it("verifies email and marks identity as active", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.identity.update.mockResolvedValue({ primaryEmail: "alice@example.com", name: "Alice" });

    await emailVerifyFlow.execute({ token: "valid-token" }, ctx);

    expect(mockConsume).toHaveBeenCalledWith("valid-token", "VERIFY_EMAIL");
    expect(ctx.db.identity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "identity-1" },
        data: { emailVerified: true, status: "ACTIVE" },
      }),
    );
  });

  it("sends welcome email after verification", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.identity.update.mockResolvedValue({ primaryEmail: "alice@example.com", name: "Alice" });

    await emailVerifyFlow.execute({ token: "valid-token" }, ctx);

    const { notificationService } = await import("@/lib/notifications/notification.service");
    expect(notificationService.sendWelcome).toHaveBeenCalledWith(
      "alice@example.com", { name: "Alice" },
    );
  });

  it("propagates invalid token errors", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    mockConsume.mockRejectedValue(new Error("Token is invalid or has expired"));

    await expect(
      emailVerifyFlow.execute({ token: "bad-token" }, ctx),
    ).rejects.toThrow("Token is invalid or has expired");
  });
});
