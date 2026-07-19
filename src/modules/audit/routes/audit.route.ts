// src/modules/audit/routes/audit.route.ts
//
// Plan gating logic:
//   SYSTEM ADMINs — unrestricted access (internal ops)
//   PRO / ENTERPRISE tenants — can query their own tenant's audit logs
//   FREE tenants — 402, upgrade required
//
// The requirePlan("PRO") guard runs first. SYSTEM ADMINs always have ENTERPRISE
// plan in their JWT (seeded that way), so they pass automatically.
//
// Business logic (SYSTEM-admin check + query) lives in
// query-audit-logs.flow.ts — see that file for a note on the ad-hoc role
// check it still contains pending real RBAC.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { flowExecutor } from "@/core/flows";
import { AuditQuerySchema } from "../validators/audit.schemas";
import { presentAuditLog } from "../presenters/audit.presenter";
import { queryAuditLogsFlow } from "../flows/query-audit-logs.flow";

export async function auditRoute(fastify: FastifyInstance) {
  fastify.get(
    "/logs",
    {
      preHandler: fastify.auth.requirePlan("PRO"),
      schema: {
        tags: ["Ecosystem Audit Guard"],
        summary:
          "Query audit logs — own logs for PRO+; all logs for SYSTEM ADMINs (PRO)",
        security: [{ bearerAuth: [] }],
        querystring: AuditQuerySchema,
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(z.any()),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              limit: z.number(),
            }),
          }),
        },
      },
    },
    async (req, reply) => {
      const query = AuditQuerySchema.parse(req.query);

      const result = await flowExecutor.run(
        queryAuditLogsFlow,
        {
          query,
          requesterIdentityId: req.identity.id,
          requesterTenantId: req.identity.tenantId ?? null,
        },
        {
          tenantId: req.identity.tenantId ?? null,
          identityId: req.identity.id,
        },
      );

      return reply.send({
        success: true,
        data: result.logs.map(presentAuditLog),
        meta: { total: result.total, page: result.page, limit: result.limit },
      });
    },
  );
}
