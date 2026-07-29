// src/modules/tenant/flows/remove-member.flow.test.ts
//
// Proves the remove-member flow:
//   - Removes a member when caller has "member:remove" permission
//   - Throws 401 without authentication
//   - Throws 403 without "member:remove" permission
//   - Throws 404 when membership is not found

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@prisma-client", () => ({
  UserStatus: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { removeMemberFlow } from "./remove-member.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

const CALLER_ID = "caller-id";
const TARGET_ID = "target-id";
const TENANT_ID = "cltenant000001testtenant1";

describe("removeMemberFlow — hasPermission('member:remove') guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes a member when caller has permission", async () => {
    const ctx = createMockFlowCtx({ identityId: CALLER_ID, tenantId: TENANT_ID });
    // hasPermission returns true: membership exists with matching permission
    ctx.db.tenantMembership.findFirst.mockResolvedValue({
      role: { permissions: [{ permissionId: "perm-member-remove" }] },
    });
    // MembershipService.remove succeeds
    ctx.db.tenantMembership.updateMany.mockResolvedValue({ count: 1 });

    const result = await removeMemberFlow.execute(
      { tenantId: TENANT_ID, identityId: TARGET_ID },
      ctx,
    );

    expect(result).toEqual({});
    expect(ctx.db.tenantMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          identityId: CALLER_ID,
          tenantId: TENANT_ID,
          status: "ACTIVE",
        }),
      }),
    );
    expect(ctx.db.tenantMembership.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, identityId: TARGET_ID, status: "ACTIVE" },
        data: { status: "INACTIVE" },
      }),
    );
  });

  it("throws 401 when not authenticated", async () => {
    const ctx = createMockFlowCtx(); // identityId undefined

    await expect(
      removeMemberFlow.execute(
        { tenantId: TENANT_ID, identityId: TARGET_ID },
        ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(ctx.db.tenantMembership.findFirst).not.toHaveBeenCalled();
  });

  it("throws 403 when caller lacks 'member:remove' permission", async () => {
    const ctx = createMockFlowCtx({ identityId: CALLER_ID, tenantId: TENANT_ID });
    // hasPermission returns false: no matching permission
    ctx.db.tenantMembership.findFirst.mockResolvedValue({
      role: { permissions: [] },
    });

    await expect(
      removeMemberFlow.execute(
        { tenantId: TENANT_ID, identityId: TARGET_ID },
        ctx,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: /member:remove/i,
    });

    expect(ctx.db.tenantMembership.updateMany).not.toHaveBeenCalled();
  });

  it("throws 403 when hasPermission returns null (no membership at all)", async () => {
    const ctx = createMockFlowCtx({ identityId: CALLER_ID, tenantId: TENANT_ID });
    ctx.db.tenantMembership.findFirst.mockResolvedValue(null);

    await expect(
      removeMemberFlow.execute(
        { tenantId: TENANT_ID, identityId: TARGET_ID },
        ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws 404 when membership to remove is not found", async () => {
    const ctx = createMockFlowCtx({ identityId: CALLER_ID, tenantId: TENANT_ID });
    // hasPermission passes
    ctx.db.tenantMembership.findFirst.mockResolvedValue({
      role: { permissions: [{ permissionId: "perm-member-remove" }] },
    });
    // MembershipService.remove fails — updateMany returns count 0
    ctx.db.tenantMembership.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      removeMemberFlow.execute(
        { tenantId: TENANT_ID, identityId: TARGET_ID },
        ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 404, message: /not found/i });
  });
});
