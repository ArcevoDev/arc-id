// src/lib/security/rbac.test.ts
//
// Unit tests for hasPermission() — the core RBAC lookup.
// All DB access is mocked via createMockDb; no Prisma connection needed.

import { describe, it, expect } from "vitest";
import { createMockDb } from "@/test-utils/mock-db";
import { hasPermission } from "./rbac";

describe("hasPermission", () => {
  const identityId = "identity-1";
  const tenantId = "tenant-1";

  it("returns true when the role-permission chain contains the action", async () => {
    const db = createMockDb();
    db.tenantMembership.findFirst.mockResolvedValue({
      role: {
        permissions: [{ permissionId: "perm-1" }],
      },
    });

    const result = await hasPermission(db, identityId, tenantId, "did:manage");
    expect(result).toBe(true);

    expect(db.tenantMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { identityId, tenantId, status: "ACTIVE" },
        select: expect.objectContaining({
          role: expect.objectContaining({
            select: expect.objectContaining({
              permissions: expect.objectContaining({
                where: { permission: { action: "did:manage" } },
              }),
            }),
          }),
        }),
      }),
    );
  });

  it("returns false when the role has no matching permission", async () => {
    const db = createMockDb();
    db.tenantMembership.findFirst.mockResolvedValue({
      role: { permissions: [] },
    });

    const result = await hasPermission(db, identityId, tenantId, "did:manage");
    expect(result).toBe(false);
  });

  it("returns false when the identity has no membership in the tenant", async () => {
    const db = createMockDb();
    db.tenantMembership.findFirst.mockResolvedValue(null);

    const result = await hasPermission(db, identityId, tenantId, "did:manage");
    expect(result).toBe(false);
  });

  it("returns false for a nonexistent permission action string", async () => {
    const db = createMockDb();
    db.tenantMembership.findFirst.mockResolvedValue({
      role: { permissions: [] },
    });

    const result = await hasPermission(
      db,
      identityId,
      tenantId,
      "this:does:not:exist:ever",
    );
    expect(result).toBe(false);
  });

  it("returns false when membership exists but status is not ACTIVE", async () => {
    const db = createMockDb();
    db.tenantMembership.findFirst.mockResolvedValue(null);

    const result = await hasPermission(db, identityId, tenantId, "did:manage");
    expect(result).toBe(false);

    // Confirm the query filters on ACTIVE — if the membership is PENDING
    // or SUSPENDED, Prisma won't return it and findFirst returns null.
    expect(db.tenantMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
  });
});
