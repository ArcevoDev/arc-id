// src/modules/identity/flows/confirm-identifier.flow.test.ts
//
// Proves the confirm-identifier flow:
//   - Validates the 6-digit code and flips verified=true
//   - Clears the code + expiry on success
//   - Throws 401 without ctx.identityId
//   - Throws 404 when record not found / not owned by identity
//   - Throws 400 when already verified
//   - Throws 400 when no pending code
//   - Throws 400 when code has expired (and clears the stale code)
//   - Throws 403 when code does not match

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@prisma-client", () => ({}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { confirmExternalIdentifierFlow } from "./confirm-identifier.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

describe("confirmExternalIdentifierFlow", () => {
  const identityId = "user-id-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("confirms with a valid code and flips verified=true", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findFirst.mockResolvedValue({
      id: "ext-1",
      type: "email",
      verified: false,
      verificationCode: "123456",
      verificationExpiresAt: new Date(Date.now() + 60_000),
    });
    ctx.db.externalIdentifier.update.mockResolvedValue({} as any);

    const result = await confirmExternalIdentifierFlow.execute(
      { id: "ext-1", code: "123456" },
      ctx,
    );

    expect(result).toEqual({ id: "ext-1", verified: true });

    expect(ctx.db.externalIdentifier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ext-1" },
        data: {
          verified: true,
          verificationCode: null,
          verificationExpiresAt: null,
        },
      }),
    );
  });

  it("throws 401 without an authenticated identity", async () => {
    const ctx = createMockFlowCtx();

    await expect(
      confirmExternalIdentifierFlow.execute({ id: "ext-1", code: "123456" }, ctx),
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
      confirmExternalIdentifierFlow.execute(
        { id: "ext-missing", code: "123456" },
        ctx,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: /not found/i,
    });

    expect(ctx.db.externalIdentifier.update).not.toHaveBeenCalled();
  });

  it("throws 400 when already verified", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findFirst.mockResolvedValue({
      id: "ext-1",
      type: "email",
      verified: true,
      verificationCode: "123456",
      verificationExpiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      confirmExternalIdentifierFlow.execute(
        { id: "ext-1", code: "123456" },
        ctx,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: /already verified/i,
    });

    expect(ctx.db.externalIdentifier.update).not.toHaveBeenCalled();
  });

  it("throws 400 when no pending code", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findFirst.mockResolvedValue({
      id: "ext-1",
      type: "email",
      verified: false,
      verificationCode: null,
      verificationExpiresAt: null,
    });

    await expect(
      confirmExternalIdentifierFlow.execute(
        { id: "ext-1", code: "123456" },
        ctx,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: /no verification code pending/i,
    });

    expect(ctx.db.externalIdentifier.update).not.toHaveBeenCalled();
  });

  it("throws 400 when code has expired and clears the stale code", async () => {
    const past = new Date(Date.now() - 1000);
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findFirst.mockResolvedValue({
      id: "ext-1",
      type: "email",
      verified: false,
      verificationCode: "123456",
      verificationExpiresAt: past,
    });
    ctx.db.externalIdentifier.update.mockResolvedValue({} as any);

    await expect(
      confirmExternalIdentifierFlow.execute(
        { id: "ext-1", code: "123456" },
        ctx,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: /expired/i,
    });

    expect(ctx.db.externalIdentifier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ext-1" },
        data: {
          verificationCode: null,
          verificationExpiresAt: null,
        },
      }),
    );
  });

  it("throws 403 when code does not match", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findFirst.mockResolvedValue({
      id: "ext-1",
      type: "email",
      verified: false,
      verificationCode: "654321",
      verificationExpiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      confirmExternalIdentifierFlow.execute(
        { id: "ext-1", code: "000000" },
        ctx,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: /invalid verification code/i,
    });

    expect(ctx.db.externalIdentifier.update).not.toHaveBeenCalled();
  });
});
