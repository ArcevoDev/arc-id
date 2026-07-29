// src/modules/identity/flows/delete-account.flow.test.ts
//
// Proves the delete-account flow:
//   - Soft-deletes identity, revokes sessions/tokens, fires notification
//   - Throws 401 without authentication
//   - Still deletes when notification fails (fire-and-forget)
//   - Handles identity without primaryEmail (no notification sent)

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@prisma-client", () => ({
  UserStatus: { ACTIVE: "ACTIVE", DELETED: "DELETED" },
  MfaType: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/security/jti-blocklist", () => ({
  blockJti: vi.fn().mockResolvedValue(undefined),
}));

const { mockSendAccountDeletion } = vi.hoisted(() => ({
  mockSendAccountDeletion: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications/notification.service", () => ({
  notificationService: {
    sendAccountDeletion: mockSendAccountDeletion,
  },
}));

import { deleteAccountFlow } from "./delete-account.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

const IDENTITY_ID = "identity-1";
const EMAIL = "alice@example.com";

function setupHappy(ctx: ReturnType<typeof createMockFlowCtx>) {
  ctx.db.identity.findUniqueOrThrow.mockResolvedValue({
    primaryEmail: EMAIL,
    name: "Alice",
  });
  ctx.db.identity.update.mockResolvedValue({} as any);
  ctx.db.session.updateMany.mockResolvedValue({ count: 1 });
  ctx.db.refreshToken.updateMany.mockResolvedValue({ count: 1 });
  ctx.db.accessToken.findMany.mockResolvedValue([
    { jti: "jti-1", expiresAt: new Date(Date.now() + 900_000) },
  ]);
  ctx.db.accessToken.updateMany.mockResolvedValue({ count: 1 });
  ctx.db.revokedJti.create.mockResolvedValue({ id: "rj-1" } as any);
  // $transaction array form — resolve each operation
  ctx.db.$transaction = vi.fn(async (ops: any[]) => Promise.all(ops));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSendAccountDeletion.mockReset().mockResolvedValue(undefined);
});

describe("deleteAccountFlow", () => {
  it("soft-deletes identity and revokes tokens/sessions", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });
    setupHappy(ctx);

    const result = await deleteAccountFlow.execute({}, ctx);

    expect(result).toEqual({});
    expect(ctx.db.identity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: IDENTITY_ID },
        data: { status: "DELETED" },
      }),
    );
    expect(ctx.db.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { identityId: IDENTITY_ID, valid: true },
        data: { valid: false },
      }),
    );
    expect(ctx.db.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { identityId: IDENTITY_ID, revoked: false },
        data: { revoked: true },
      }),
    );
    expect(ctx.db.accessToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { identityId: IDENTITY_ID, revoked: false, jti: { not: null } },
      }),
    );
    expect(ctx.db.revokedJti.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ jti: "jti-1" }) }),
    );
    expect(mockSendAccountDeletion).toHaveBeenCalledWith(EMAIL, {
      name: "Alice",
      graceDays: 30,
    });
  });

  it("throws 401 when not authenticated", async () => {
    const ctx = createMockFlowCtx();

    await expect(deleteAccountFlow.execute({}, ctx)).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(ctx.db.identity.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("still deletes account when notification fails (fire-and-forget)", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });
    setupHappy(ctx);
    mockSendAccountDeletion.mockRejectedValue(new Error("SMTP timeout"));

    const result = await deleteAccountFlow.execute({}, ctx);

    expect(result).toEqual({});
    expect(ctx.db.identity.update).toHaveBeenCalled();
  });

  it("handles identity without primaryEmail gracefully", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });
    ctx.db.identity.findUniqueOrThrow.mockResolvedValue({
      primaryEmail: null,
      name: "No Email",
    });
    ctx.db.identity.update.mockResolvedValue({} as any);
    ctx.db.session.updateMany.mockResolvedValue({ count: 1 });
    ctx.db.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    ctx.db.accessToken.findMany.mockResolvedValue([]);
    ctx.db.accessToken.updateMany.mockResolvedValue({ count: 1 });
    ctx.db.$transaction = vi.fn(async (ops: any[]) => Promise.all(ops));

    const result = await deleteAccountFlow.execute({}, ctx);

    expect(result).toEqual({});
    // No notification should be sent without an email
    expect(mockSendAccountDeletion).not.toHaveBeenCalled();
  });
});
