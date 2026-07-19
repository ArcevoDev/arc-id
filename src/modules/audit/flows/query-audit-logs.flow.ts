// src/modules/audit/flows/query-audit-logs.flow.ts
//
// RESOLVED: the previous ad-hoc `role.name === "ADMIN"` check is now
// replaced with hasPermission(..., "audit:read:any") via the RBAC system.

import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { hasPermission } from "@/lib/security/rbac";
import { AuditQuerySchema } from "../validators/audit.schemas";
import { AuditRepository } from "../repositories/audit.repository";

const QueryAuditLogsInputSchema = z.object({
  query: AuditQuerySchema,
  requesterIdentityId: z.string(),
  requesterTenantId: z.string().nullable().optional(),
});

type Input = z.infer<typeof QueryAuditLogsInputSchema>;

type Output = Awaited<ReturnType<AuditRepository["query"]>>;

export const queryAuditLogsFlow: Flow<Input, Output> = {
  name: "audit:query-logs",
  inputSchema: QueryAuditLogsInputSchema,

  async execute(input, ctx: FlowContext) {
    const { query, requesterIdentityId, requesterTenantId } = input;

    // SYSTEM members with audit:read:any can filter by any identity or tenant.
    // PRO/ENTERPRISE tenant admins see their own tenant's logs only.
    const isSystemAdmin = await hasPermission(
      ctx.db,
      requesterIdentityId,
      "SYSTEM",
      "audit:read:any",
    );

    const auditRepo = new AuditRepository(ctx.db);
    return auditRepo.query({
      identityId: isSystemAdmin ? query.identityId : requesterIdentityId,
      tenantId: isSystemAdmin
        ? query.tenantId
        : (requesterTenantId ?? undefined),
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      limit: query.limit,
    });
  },
};
