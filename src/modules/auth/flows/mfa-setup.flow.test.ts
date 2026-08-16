// src/modules/auth/flows/mfa-setup.flow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));

vi.mock("@prisma-client", () => ({
  UserStatus: {},
  MfaType: { TOTP: "TOTP" },
  AuditLogAction: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

const mockSetupTotp = vi.fn();
const mockConfirmTotp = vi.fn();
const mockGenerateRecoveryCodes = vi.fn();
vi.mock("../services/mfa.service", () => ({
  MfaService: vi.fn().mockImplementation(function () {
    return {
      setupTotp: mockSetupTotp,
      confirmTotp: mockConfirmTotp,
      generateRecoveryCodes: mockGenerateRecoveryCodes,
    };
  }),
}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/notifications/notification.service", () => ({
  notificationService: {
    sendRecoveryCodes: vi.fn().mockResolvedValue(undefined),
    sendMfaDisabledAlert: vi.fn().mockResolvedValue(undefined),
  },
}));

import { mfaSetupFlow, mfaConfirmFlow, disableMfa } from "./mfa-setup.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";
import { ApiError } from "@/core/errors";

describe("mfaSetupFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetupTotp.mockReset().mockResolvedValue({ secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/ArcID:test?secret=JBSWY", qrCode: "data:image/png;base64,iVBOR" });
  });

  it("returns TOTP setup data", async () => {
    const ctx = createMockFlowCtx({ identityId: "identity-1" });
    ctx.db.identity.findUniqueOrThrow.mockResolvedValue({ id: "identity-1", primaryEmail: "test@example.com" });

    const result = await mfaSetupFlow.execute({ type: "TOTP" }, ctx);
    expect(result).toMatchObject({ secret: expect.any(String), uri: expect.any(String), qrCode: expect.any(String) });
    expect(mockSetupTotp).toHaveBeenCalledWith("identity-1", "test@example.com");
  });

  it("throws unauthorized when not logged in", async () => {
    const ctx = createMockFlowCtx({ identityId: undefined });
    await expect(mfaSetupFlow.execute({ type: "TOTP" }, ctx)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("mfaConfirmFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirmTotp.mockReset().mockResolvedValue(true);
    mockGenerateRecoveryCodes.mockReset().mockResolvedValue(["RC-AAAA", "RC-BBBB"]);
  });

  it("confirms TOTP and returns recovery codes", async () => {
    const ctx = createMockFlowCtx({ identityId: "identity-1" });
    ctx.db.identity.findUnique.mockResolvedValue({ primaryEmail: "test@example.com", name: "Test" });

    const result = await mfaConfirmFlow.execute({ code: "123456" }, ctx);
    expect(result.recoveryCodes).toEqual(["RC-AAAA", "RC-BBBB"]);
    expect(mockConfirmTotp).toHaveBeenCalledWith("identity-1", "123456");
  });

  it("throws badRequest when TOTP confirm fails", async () => {
    const ctx = createMockFlowCtx({ identityId: "identity-1" });
    mockConfirmTotp.mockResolvedValue(false);

    await expect(mfaConfirmFlow.execute({ code: "000000" }, ctx)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws unauthorized when not logged in", async () => {
    const ctx = createMockFlowCtx({ identityId: undefined });
    await expect(mfaConfirmFlow.execute({ code: "123456" }, ctx)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("disableMfa", () => {
  it("disables all MFA methods for the identity", async () => {
    const db = createMockFlowCtx({ identityId: "identity-1" }).db;
    db.identity.findUnique.mockResolvedValue({ primaryEmail: null });

    await disableMfa("identity-1", db, "127.0.0.1");

    expect(db.mfa.updateMany).toHaveBeenCalledWith({
      where: { identityId: "identity-1" },
      data: { enabled: false },
    });
  });
});
