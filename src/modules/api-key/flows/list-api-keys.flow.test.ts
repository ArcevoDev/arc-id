import { describe, it, expect, vi } from "vitest";
import { listApiKeysFlow } from "./list-api-keys.flow";
import { createMockDb, createMockFlowCtx } from "@/test-utils/mock-db";
import { ApiError } from "@/core/errors";

describe("listApiKeysFlow", () => {
  it("returns active keys for the caller", async () => {
    const db = createMockDb();
    db.apiKey = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "ak_1",
          name: "CI Key",
          keyPrefix: "arc_s",
          scopes: ["read:tenants"],
          status: "ACTIVE",
          lastUsedAt: null,
          createdAt: new Date(),
        },
      ]),
    };

    const result = await listApiKeysFlow.execute(
      {},
      createMockFlowCtx({ identityId: "id_1", tenantId: "tnt_1", db }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ak_1");
  });

  it("throws 401 when not authenticated", async () => {
    const db = createMockDb();
    await expect(
      listApiKeysFlow.execute(
        {},
        createMockFlowCtx({ identityId: undefined, tenantId: "tnt_1", db }),
      ),
    ).rejects.toThrow(ApiError);
  });
});
