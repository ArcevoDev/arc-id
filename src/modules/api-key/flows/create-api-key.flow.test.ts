import { describe, it, expect, vi } from "vitest";
import { createApiKeyFlow } from "./create-api-key.flow";
import { createMockDb, createMockFlowCtx } from "@/test-utils/mock-db";
import { ApiError } from "@/core/errors";

describe("createApiKeyFlow", () => {
  it("generates and stores a key, returns plaintext once", async () => {
    const db = createMockDb();
    db.apiKey = {
      create: vi.fn().mockResolvedValue({
        id: "ak_123",
        name: "CI-CD Key",
        keyPrefix: "arc_sk_a",
        scopes: ["read:tenants"],
        createdAt: new Date(),
      }),
    };

    await expect(
      createApiKeyFlow.execute(
        { name: "CI-CD Key", scopes: ["read:tenants"] },
        createMockFlowCtx({ identityId: "id_1", tenantId: "tnt_1", db }),
      ),
    ).resolves.toMatchObject({
      id: "ak_123",
      name: "CI-CD Key",
      keyPrefix: "arc_sk_a",
      scopes: ["read:tenants"],
    });

    // The plaintext key must be present in the response
    const result = await createApiKeyFlow.execute(
      { name: "CI-CD Key", scopes: ["read:tenants"] },
      createMockFlowCtx({ identityId: "id_1", tenantId: "tnt_1", db }),
    );
    expect(result.key).toMatch(/^arc_sk_/);

    // The stored hash must NOT be the plaintext
    expect(db.apiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          keyHash: expect.not.stringContaining("arc_sk_"),
        }),
      }),
    );
  });

  it("throws 401 when not authenticated", async () => {
    const db = createMockDb();
    await expect(
      createApiKeyFlow.execute(
        { name: "key", scopes: [] },
        createMockFlowCtx({ identityId: undefined, tenantId: "tnt_1", db }),
      ),
    ).rejects.toThrow(ApiError);
  });

  it("throws 400 when tenant context is missing", async () => {
    const db = createMockDb();
    await expect(
      createApiKeyFlow.execute(
        { name: "key", scopes: [] },
        createMockFlowCtx({ identityId: "id_1", tenantId: undefined, db }),
      ),
    ).rejects.toThrow(ApiError);
  });
});
