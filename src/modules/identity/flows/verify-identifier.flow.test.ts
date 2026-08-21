// src/modules/identity/flows/verify-identifier.flow.test.ts
//
// Proves the verify-identifier flow:
//   - Sends a 6-digit code to email or phone displayValue
//   - Stores the code + TTL on the ExternalIdentifier record
//   - Throws 401 without ctx.identityId
//   - Throws 404 when record not found / not owned by identity
//   - Throws 400 when already verified
//   - Throws 400 for unsupported identifier types
//   - Throws 400 when no displayValue available for delivery

import { vi, describe, it, expect, beforeEach } from "vitest";
import { randomInt } from "crypto";

vi.mock("@prisma-client", () => ({}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/notifications/notification.service", () => ({
  notificationService: {
    sendMfaCode: vi.fn().mockResolvedValue(undefined),
    sendMfaCodeSms: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("crypto", () => ({
  randomInt: vi.fn(),
  randomUUID: vi.fn(() => "test-uuid"),
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => Buffer.from("deadbeef")),
  })),
  timingSafeEqual: vi.fn(),
}));

import { verifyExternalIdentifierFlow } from "./verify-identifier.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";
import { notificationService } from "@/lib/notifications/notification.service";

describe("verifyExternalIdentifierFlow", () => {
  const identityId = "user-id-1";

  beforeEach(() => {
    vi.clearAllMocks();
    (randomInt as any).mockReturnValue(123456);
  });

  it("sends a 6-digit code to an email identifier and stores it", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findFirst.mockResolvedValue({
      id: "ext-1",
      type: "email",
      displayValue: "user@example.com",
      verified: false,
    });
    ctx.db.externalIdentifier.update.mockResolvedValue({} as any);

    const result = await verifyExternalIdentifierFlow.execute(
      { id: "ext-1" },
      ctx,
    );

    expect(result).toEqual({ success: true, type: "email" });

    expect(ctx.db.externalIdentifier.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ext-1", identityId },
        select: {
          id: true,
          type: true,
          displayValue: true,
          verified: true,
        },
      }),
    );

    expect(ctx.db.externalIdentifier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ext-1" },
        data: expect.objectContaining({
          verificationCode: "123456",
          verificationExpiresAt: expect.any(Date),
        }),
      }),
    );

    expect(notificationService.sendMfaCode).toHaveBeenCalledWith(
      "user@example.com",
      "123456",
      expect.objectContaining({ ttlSec: 600 }),
    );
  });

  it("sends an SMS code to a phone identifier", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findFirst.mockResolvedValue({
      id: "ext-2",
      type: "phone",
      displayValue: "+15551234567",
      verified: false,
    });
    ctx.db.externalIdentifier.update.mockResolvedValue({} as any);

    const result = await verifyExternalIdentifierFlow.execute(
      { id: "ext-2" },
      ctx,
    );

    expect(result).toEqual({ success: true, type: "phone" });
    expect(notificationService.sendMfaCodeSms).toHaveBeenCalledWith(
      "+15551234567",
      "123456",
    );
    expect(notificationService.sendMfaCode).not.toHaveBeenCalled();
  });

  it("throws 401 without an authenticated identity", async () => {
    const ctx = createMockFlowCtx();

    await expect(
      verifyExternalIdentifierFlow.execute({ id: "ext-1" }, ctx),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: /authenticated identity required/i,
    });

    expect(ctx.db.externalIdentifier.findFirst).not.toHaveBeenCalled();
  });

  it("throws 404 when identifier not found", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findFirst.mockResolvedValue(null);

    await expect(
      verifyExternalIdentifierFlow.execute({ id: "ext-missing" }, ctx),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: /not found/i,
    });

    expect(ctx.db.externalIdentifier.update).not.toHaveBeenCalled();
    expect(notificationService.sendMfaCode).not.toHaveBeenCalled();
  });

  it("throws 400 when already verified", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findFirst.mockResolvedValue({
      id: "ext-1",
      type: "email",
      displayValue: "user@example.com",
      verified: true,
    });

    await expect(
      verifyExternalIdentifierFlow.execute({ id: "ext-1" }, ctx),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: /already verified/i,
    });

    expect(ctx.db.externalIdentifier.update).not.toHaveBeenCalled();
  });

  it("throws 400 for unsupported identifier types", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findFirst.mockResolvedValue({
      id: "ext-3",
      type: "passport",
      displayValue: "P12345678",
      verified: false,
    });

    await expect(
      verifyExternalIdentifierFlow.execute({ id: "ext-3" }, ctx),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: /verification is only supported/i,
    });

    expect(ctx.db.externalIdentifier.update).not.toHaveBeenCalled();
  });

  it("throws 400 when no displayValue available for delivery", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findFirst.mockResolvedValue({
      id: "ext-1",
      type: "email",
      displayValue: null,
      verified: false,
    });
    ctx.db.externalIdentifier.update.mockResolvedValue({} as any);

    await expect(
      verifyExternalIdentifierFlow.execute({ id: "ext-1" }, ctx),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: /no contact value available/i,
    });

    expect(notificationService.sendMfaCode).not.toHaveBeenCalled();
  });
});
