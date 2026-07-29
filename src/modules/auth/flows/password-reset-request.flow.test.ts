// src/modules/auth/flows/password-reset-request.flow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/core/db", () => ({ prisma: { $extends: vi.fn(() => ({})) } }));
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

const mockEmailTokenIssue = vi.fn();
vi.mock("../services/email-token.service", () => ({
  EmailTokenService: vi.fn().mockImplementation(function () {
    return { issue: mockEmailTokenIssue };
  }),
}));
vi.mock("@/lib/notifications/notification.service", () => ({
  notificationService: { sendPasswordReset: vi.fn().mockResolvedValue(undefined) },
}));

import { passwordResetRequestFlow } from "./password-reset-request.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

describe("passwordResetRequestFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmailTokenIssue.mockReset().mockResolvedValue("reset-token-abc");
  });

  it("issues a password reset token and sends email", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.identity.findUnique.mockResolvedValue({ id: "identity-1", primaryEmail: "alice@example.com", name: "Alice" });

    await passwordResetRequestFlow.execute({ email: "alice@example.com" }, ctx);

    expect(mockEmailTokenIssue).toHaveBeenCalledWith("identity-1", "RESET_PASSWORD");
    const { notificationService } = await import("@/lib/notifications/notification.service");
    expect(notificationService.sendPasswordReset).toHaveBeenCalledWith(
      "alice@example.com", "reset-token-abc", expect.any(Object),
    );
  });

  it("is idempotent when email does not exist (no throw)", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.identity.findUnique.mockResolvedValue(null);

    await expect(
      passwordResetRequestFlow.execute({ email: "nobody@example.com" }, ctx),
    ).resolves.toEqual({});
    expect(mockEmailTokenIssue).not.toHaveBeenCalled();
  });
});
