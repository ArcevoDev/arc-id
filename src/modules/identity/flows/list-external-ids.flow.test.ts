// src/modules/identity/flows/list-external-ids.flow.test.ts

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@prisma-client", () => ({}));

import { listExternalIdsFlow } from "./list-external-ids.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

describe("listExternalIdsFlow", () => {
  const identityId = "user-id-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all external identifiers for the identity", async () => {
    const ctx = createMockFlowCtx({ identityId });
    const mockRecords = [
      {
        id: "ext-1",
        type: "email",
        displayValue: "alice@example.com",
        verified: false,
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        id: "ext-2",
        type: "phone",
        displayValue: null,
        verified: false,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ];
    ctx.db.externalIdentifier.findMany.mockResolvedValue(mockRecords);

    const result = await listExternalIdsFlow.execute({ identityId }, ctx);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("email");
    expect(result[1].type).toBe("phone");
    expect(result[0].displayValue).toBe("alice@example.com");
    expect(result[1].displayValue).toBeNull();

    expect(ctx.db.externalIdentifier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { identityId },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("returns an empty array when no identifiers are linked", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findMany.mockResolvedValue([]);

    const result = await listExternalIdsFlow.execute({ identityId }, ctx);

    expect(result).toEqual([]);
  });

  it("never returns valueHash in output", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findMany.mockResolvedValue([
      {
        id: "ext-1",
        type: "email",
        displayValue: "test@example.com",
        verified: false,
        createdAt: new Date(),
      },
    ]);

    const result = await listExternalIdsFlow.execute({ identityId }, ctx);

    expect(result[0]).not.toHaveProperty("valueHash");
    expect(result[0]).not.toHaveProperty("value");
  });
});
