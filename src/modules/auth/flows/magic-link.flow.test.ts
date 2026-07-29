// src/modules/auth/flows/magic-link.flow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));

vi.mock("@prisma-client", () => ({
  UserStatus: { ACTIVE: "ACTIVE", BANNED: "BANNED", SUSPENDED: "SUSPENDED", DELETED: "DELETED" },
  MfaType: {},
  AuditLogAction: {},
  VcFormat: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

vi.mock("@/api/plugins/jwt.plugin", () => ({ resolvePemContent: vi.fn(() => "") }));
vi.mock("@/core/db", () => ({ prisma: {} }));

const mockConsume = vi.fn();
const mockSessionCreate = vi.fn();
const mockTokenIssue = vi.fn();
vi.mock("../services/email-token.service", () => ({
  EmailTokenService: vi.fn().mockImplementation(function () {
    return { consume: mockConsume };
  }),
}));
vi.mock("../services/session.service", () => ({
  SessionService: vi.fn().mockImplementation(function () {
    return { create: mockSessionCreate };
  }),
}));
vi.mock("@/modules/oauth/services/token.service", () => ({
  TokenService: vi.fn().mockImplementation(function () {
    return { issue: mockTokenIssue };
  }),
}));

import { magicLinkFlow } from "./magic-link.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";
import { config } from "@/core/config";

const mockTokenBundle = { accessToken: "at-1", refreshToken: "rt-1", idToken: null, expiresIn: 3600 };

describe("magicLinkFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsume.mockReset().mockResolvedValue({ identityId: "identity-1" });
    mockSessionCreate.mockReset().mockResolvedValue({ session: { id: "session-1" } });
    mockTokenIssue.mockReset().mockResolvedValue(mockTokenBundle);
  });

  it("exchanges a magic link token for tokens", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.identity.findUniqueOrThrow.mockResolvedValue({
      id: "identity-1",
      primaryEmail: "alice@example.com",
      status: "ACTIVE",
    });

    const result = await magicLinkFlow.execute({ token: "valid-token" }, ctx);

    expect(mockConsume).toHaveBeenCalledWith("valid-token", "MAGIC_LINK");
    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ identityId: "identity-1", authLevel: "aal1" }),
    );
    expect(result).toMatchObject({ accessToken: "at-1", sessionId: "session-1" });
  });

  it("throws forbidden when identity is banned", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.identity.findUniqueOrThrow.mockResolvedValue({ id: "identity-1", status: "BANNED" });

    await expect(
      magicLinkFlow.execute({ token: "valid-token" }, ctx),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws forbidden when identity is suspended", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.identity.findUniqueOrThrow.mockResolvedValue({ id: "identity-1", status: "SUSPENDED" });

    await expect(
      magicLinkFlow.execute({ token: "valid-token" }, ctx),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("propagates email token service errors", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    mockConsume.mockRejectedValue(new Error("Token is invalid or has expired"));

    await expect(
      magicLinkFlow.execute({ token: "expired" }, ctx),
    ).rejects.toThrow("Token is invalid or has expired");
  });
});
