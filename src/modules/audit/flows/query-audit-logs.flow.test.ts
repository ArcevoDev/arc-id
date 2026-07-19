import { describe, it, expect } from "vitest";
import { queryAuditLogsFlow } from "./query-audit-logs.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

const baseQuery = {
  page: 1,
  limit: 20,
} as any;

describe("queryAuditLogsFlow", () => {
  it("scopes a non-admin requester to their own identityId/tenantId, ignoring query filters", async () => {
    const ctx = createMockFlowCtx();
    ctx.db.tenantMembership.findFirst.mockResolvedValue(null); // not a SYSTEM admin
    ctx.db.auditLog.findMany.mockResolvedValue([]);
    ctx.db.auditLog.count.mockResolvedValue(0);

    await queryAuditLogsFlow.execute(
      {
        query: {
          ...baseQuery,
          identityId: "someone-elses-id",
          tenantId: "some-other-tenant",
        },
        requesterIdentityId: "me",
        requesterTenantId: "my-tenant",
      },
      ctx,
    );

    expect(ctx.db.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { identityId: "me", tenantId: "my-tenant" },
      }),
    );
  });

  it("lets a SYSTEM ADMIN requester filter by any identityId/tenantId from the query", async () => {
    const ctx = createMockFlowCtx();
    ctx.db.tenantMembership.findFirst.mockResolvedValue({
      role: { name: "ADMIN" },
    });
    ctx.db.auditLog.findMany.mockResolvedValue([]);
    ctx.db.auditLog.count.mockResolvedValue(0);

    await queryAuditLogsFlow.execute(
      {
        query: {
          ...baseQuery,
          identityId: "target-id",
          tenantId: "target-tenant",
        },
        requesterIdentityId: "admin-id",
        requesterTenantId: "SYSTEM",
      },
      ctx,
    );

    expect(ctx.db.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { identityId: "target-id", tenantId: "target-tenant" },
      }),
    );
  });

  it("does NOT grant admin scope for a non-ADMIN SYSTEM-tenant membership (e.g. MEMBER role)", async () => {
    const ctx = createMockFlowCtx();
    ctx.db.tenantMembership.findFirst.mockResolvedValue({
      role: { name: "MEMBER" },
    });
    ctx.db.auditLog.findMany.mockResolvedValue([]);
    ctx.db.auditLog.count.mockResolvedValue(0);

    await queryAuditLogsFlow.execute(
      {
        query: {
          ...baseQuery,
          identityId: "someone-else",
          tenantId: "someone-elses-tenant",
        },
        requesterIdentityId: "me",
        requesterTenantId: "my-tenant",
      },
      ctx,
    );

    expect(ctx.db.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { identityId: "me", tenantId: "my-tenant" },
      }),
    );
  });
});
