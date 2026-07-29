// src/modules/auth/flows/set-username.flow.test.ts
//
// Proves the set-username flow:
//   - Sets username on valid request
//   - Throws 401 without authentication
//   - Throws 409 when username is taken (pre-check)
//   - Throws 409 on unique constraint race (P2002)

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@prisma-client", () => ({
  UserStatus: {},
  MfaType: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
}));

const mockIsUsernameTaken = vi.fn();
const mockSetUsername = vi.fn();
vi.mock("@/modules/auth/repositories/identity.repository", () => ({
  IdentityRepository: vi.fn().mockImplementation(function () {
    return { isUsernameTaken: mockIsUsernameTaken, setUsername: mockSetUsername };
  }),
}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { setUsernameFlow } from "./set-username.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

const IDENTITY_ID = "identity-1";

beforeEach(() => {
  vi.clearAllMocks();
  mockIsUsernameTaken.mockReset().mockResolvedValue(false);
  mockSetUsername.mockReset().mockResolvedValue({
    id: IDENTITY_ID,
    primaryEmail: "alice@example.com",
    emailVerified: true,
    name: "Alice",
    picture: null,
    username: "alice123",
    status: "ACTIVE",
    metadata: {},
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-06-01"),
  });
});

describe("setUsernameFlow", () => {
  it("sets username successfully", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });

    const result = await setUsernameFlow.execute({ username: "alice123" }, ctx);

    expect(mockIsUsernameTaken).toHaveBeenCalledWith("alice123", IDENTITY_ID);
    expect(mockSetUsername).toHaveBeenCalledWith(IDENTITY_ID, "alice123");
    expect(result.identity).toBeDefined();
    expect(result.identity.username).toBe("alice123");
  });

  it("throws 401 when not authenticated", async () => {
    const ctx = createMockFlowCtx(); // identityId undefined

    await expect(
      setUsernameFlow.execute({ username: "alice123" }, ctx),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(mockIsUsernameTaken).not.toHaveBeenCalled();
  });

  it("throws 409 when username is already taken", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });
    mockIsUsernameTaken.mockResolvedValue(true);

    await expect(
      setUsernameFlow.execute({ username: "taken_User" }, ctx),
    ).rejects.toMatchObject({ statusCode: 409, message: /already taken/i });

    expect(mockSetUsername).not.toHaveBeenCalled();
  });

  it("throws 409 on unique constraint race (P2002)", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });
    mockIsUsernameTaken.mockResolvedValue(false);
    const p2002 = new Error("Unique constraint failed");
    (p2002 as any).code = "P2002";
    mockSetUsername.mockRejectedValue(p2002);

    await expect(
      setUsernameFlow.execute({ username: "racer" }, ctx),
    ).rejects.toMatchObject({ statusCode: 409, message: /already taken/i });
  });

  it("propagates unexpected DB errors", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });
    mockSetUsername.mockRejectedValue(new Error("DB connection lost"));

    await expect(
      setUsernameFlow.execute({ username: "alice123" }, ctx),
    ).rejects.toThrow("DB connection lost");
  });
});
