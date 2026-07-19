// src/modules/identity/flows/unlink-external-id.flow.test.ts
//
// Proves the unlink-external-id flow:
//   - Deletes own external identifier
//   - Throws 404 if not found
//   - Throws 403 if trying to delete another identity's identifier

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@prisma-client", () => ({}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { unlinkExternalIdFlow } from "./unlink-external-id.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

describe("unlinkExternalIdFlow", () => {
  const identityId = "user-id-1";
  const otherIdentityId = "user-id-2";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes own external identifier", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findUnique.mockResolvedValue({
      id: "ext-1",
      identityId,
      type: "email",
    });
    ctx.db.externalIdentifier.delete.mockResolvedValue({} as any);

    await unlinkExternalIdFlow.execute({ id: "ext-1", identityId }, ctx);

    expect(ctx.db.externalIdentifier.delete).toHaveBeenCalledWith({
      where: { id: "ext-1" },
    });
  });

  it("throws 404 when identifier does not exist", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findUnique.mockResolvedValue(null);

    await expect(
      unlinkExternalIdFlow.execute({ id: "ext-missing", identityId }, ctx),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: /not found/i,
    });

    expect(ctx.db.externalIdentifier.delete).not.toHaveBeenCalled();
  });

  it("throws 403 when trying to delete another identity's identifier", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findUnique.mockResolvedValue({
      id: "ext-1",
      identityId: otherIdentityId,
      type: "email",
    });

    await expect(
      unlinkExternalIdFlow.execute({ id: "ext-1", identityId }, ctx),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: /your own/i,
    });

    expect(ctx.db.externalIdentifier.delete).not.toHaveBeenCalled();
  });
});
