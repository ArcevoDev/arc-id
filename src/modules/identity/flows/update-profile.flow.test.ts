// src/modules/identity/flows/update-profile.flow.test.ts
//
// Proves the update-profile flow:
//   - Updates name, picture, and metadata
//   - Throws 401 without authentication
//   - Handles partial update (only picture)

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@prisma-client", () => ({
  UserStatus: {},
  MfaType: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
}));

const mockUpdate = vi.fn();
vi.mock("../services/profile.service", () => ({
  ProfileService: vi.fn().mockImplementation(function () {
    return { update: mockUpdate };
  }),
}));

vi.mock("../presenters/identity.presenter", () => ({
  presentIdentity: vi.fn((id: any) => ({
    id: id?.id ?? "identity-1",
    email: "alice@example.com",
    name: id?.name ?? "Alice",
    picture: id?.picture ?? null,
    status: "ACTIVE",
    emailVerified: true,
    roles: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-06-01T00:00:00.000Z",
  })),
}));

import { updateProfileFlow } from "./update-profile.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

const IDENTITY_ID = "identity-1";

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockReset().mockResolvedValue({
    id: IDENTITY_ID,
    primaryEmail: "alice@example.com",
    emailVerified: true,
    name: "Alice Updated",
    picture: "https://example.com/pic.jpg",
    username: null,
    status: "ACTIVE",
    metadata: { theme: "dark" },
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-06-01"),
  });
});

describe("updateProfileFlow", () => {
  it("updates all profile fields", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });

    const result = await updateProfileFlow.execute(
      {
        name: "Alice Updated",
        picture: "https://example.com/pic.jpg",
        metadata: { theme: "dark" },
      },
      ctx,
    );

    expect(result.identity).toBeDefined();
    expect(result.identity.name).toBe("Alice Updated");
    expect(mockUpdate).toHaveBeenCalledWith(IDENTITY_ID, {
      name: "Alice Updated",
      picture: "https://example.com/pic.jpg",
      metadata: { theme: "dark" },
    });
  });

  it("throws 401 when not authenticated", async () => {
    const ctx = createMockFlowCtx();

    await expect(
      updateProfileFlow.execute({ name: "Evil Hacker" }, ctx),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("handles partial update (only picture)", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });
    mockUpdate.mockResolvedValue({
      id: IDENTITY_ID,
      primaryEmail: "alice@example.com",
      emailVerified: true,
      name: "Alice",
      picture: "https://example.com/new-pic.jpg",
      username: null,
      status: "ACTIVE",
      metadata: null,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-06-01"),
    });

    const result = await updateProfileFlow.execute(
      { picture: "https://example.com/new-pic.jpg" },
      ctx,
    );

    expect(result.identity.picture).toBe("https://example.com/new-pic.jpg");
    expect(mockUpdate).toHaveBeenCalledWith(IDENTITY_ID, {
      picture: "https://example.com/new-pic.jpg",
    });
  });

  it("propagates service errors", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });
    mockUpdate.mockRejectedValue(new Error("DB timeout"));

    await expect(
      updateProfileFlow.execute({ name: "Alice" }, ctx),
    ).rejects.toThrow("DB timeout");
  });
});
