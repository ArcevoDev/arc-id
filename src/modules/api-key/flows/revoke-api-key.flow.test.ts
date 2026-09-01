import { describe, it, expect, vi } from "vitest";
import { revokeApiKeyFlow } from "./revoke-api-key.flow";
import { createMockDb, createMockFlowCtx } from "@/test-utils/mock-db";
import { ApiError } from "@/core/errors";

describe("revokeApiKeyFlow", () => {
  it("revokes an existing active key", async () => {
    const db = createMockDb();
    db.apiKey = {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };

    await expect(
      revokeApiKeyFlow.execute(
        { id: "ak_123" },
        createMockFlowCtx({ identityId: "id_1", tenantId: "tnt_1", db }),
      ),
    ).resolves.toBeUndefined();

    expect(db.apiKey.updateMany).toHaveBeenCalledWith({
      where: { id: "ak_123", tenantId: "tnt_1", status: "ACTIVE" },
      data: { status: "REVOKED" },
    });
  });

  it("throws 404 when key not found or already revoked", async () => {
    const db = createMockDb();
    db.apiKey = {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    };

    await expect(
      revokeApiKeyFlow.execute(
        { id: "unknown" },
        createMockFlowCtx({ identityId: "id_1", tenantId: "tnt_1", db }),
      ),
    ).rejects.toThrow(ApiError);
  });
});
