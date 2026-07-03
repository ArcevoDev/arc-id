// src/modules/audit/routes/audit.route.ts
//
// Plan gating logic:
//   SYSTEM ADMINs — unrestricted access (internal ops)
//   PRO / ENTERPRISE tenants — can query their own tenant's audit logs
//   FREE tenants — 402, upgrade required
//
// The requirePlan("PRO") guard runs first. SYSTEM ADMINs always have ENTERPRISE
// plan in their JWT (seeded that way), so they pass automatically.
import type { FastifyInstance } from "fastify";
import { AuditQuerySchema } from "../validators/audit.schemas";
import { AuditRepository } from "../repositories/audit.repository";
import { presentAuditLog } from "../presenters/audit.presenter";
import { z } from "zod";

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

      // SYSTEM ADMINs can filter by any identity or tenant.
      // PRO/ENTERPRISE tenant admins see their own tenant's logs only.
      const systemMembership = await fastify.db.tenantMembership.findFirst({
        where: {
          identityId: req.identity.id,
          tenantId: "SYSTEM",
          status: "ACTIVE",
        },
        include: { role: { select: { name: true } } },
      });
      const isSystemAdmin = systemMembership?.role.name === "ADMIN";

      const auditRepo = new AuditRepository(fastify.db);
      const result = await auditRepo.query({
        identityId: isSystemAdmin ? query.identityId : req.identity.id,
        tenantId: isSystemAdmin
          ? query.tenantId
          : (req.identity.tenantId ?? undefined),
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        page: query.page,
        limit: query.limit,
      });

      return reply.send({
        success: true,
        data: result.logs.map(presentAuditLog),
        meta: { total: result.total, page: result.page, limit: result.limit },
      });
    },
  );
}
