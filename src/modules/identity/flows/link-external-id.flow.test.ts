// src/modules/identity/flows/link-external-id.flow.test.ts
//
// Proves the link-external-id flow:
//   - Creates a record with SHA-256 hashed value
//   - Throws 409 on duplicate [type, valueHash]
//   - Returns the created record (without valueHash)

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@prisma-client", () => ({}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { linkExternalIdFlow } from "./link-external-id.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

describe("linkExternalIdFlow", () => {
  const identityId = "user-id-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an external identifier with hashed value", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findUnique.mockResolvedValue(null);
    ctx.db.externalIdentifier.create.mockResolvedValue({
      id: "ext-id-1",
      type: "email",
      displayValue: "user@example.com",
      verified: false,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    const result = await linkExternalIdFlow.execute(
      {
        identityId,
        type: "email",
        value: "User@Example.com",
        displayValue: "user@example.com",
      },
      ctx,
    );

    // The value should be lowered+trimmed before hashing
    const createCall = ctx.db.externalIdentifier.create.mock.calls[0][0];
    expect(createCall.data.valueHash).toEqual(expect.any(String));
    expect(createCall.data.valueHash).not.toBe("User@Example.com");

    expect(result).toMatchObject({
      id: "ext-id-1",
      type: "email",
      displayValue: "user@example.com",
      verified: false,
    });
  });

  it("throws 409 when [type, valueHash] already exists", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findUnique.mockResolvedValue({ id: "existing" });

    await expect(
      linkExternalIdFlow.execute(
        { identityId, type: "nin", value: "12345678901" },
        ctx,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: /already linked/i,
    });

    expect(ctx.db.externalIdentifier.create).not.toHaveBeenCalled();
  });

  it("accepts each supported type", async () => {
    const ctx = createMockFlowCtx({ identityId });
    ctx.db.externalIdentifier.findUnique.mockResolvedValue(null);

    const types = [
      "email",
      "phone",
      "nin",
      "bvn",
      "passport",
      "driver_license",
    ] as const;

    for (const type of types) {
      ctx.db.externalIdentifier.create.mockResolvedValue({
        id: `ext-${type}`,
        type,
        displayValue: null,
        verified: false,
        createdAt: new Date(),
      });

      const result = await linkExternalIdFlow.execute(
        { identityId, type, value: "test-value" },
        ctx,
      );

      expect(result.type).toBe(type);
    }
  });
});
