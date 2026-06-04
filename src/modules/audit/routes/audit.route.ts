// src/modules/audit/routes/audit.route.ts
// FIX: was requireScope("admin:read") — no token ever has this scope → always 403.
// New logic: any authenticated user can query their own logs; SYSTEM ADMINs see all.
import type { FastifyInstance } from "fastify";
import { AuditQuerySchema } from "../validators/audit.schemas";
import { AuditRepository } from "../repositories/audit.repository";
import { presentAuditLog } from "../presenters/audit.presenter";
import { z } from "zod";

export async function auditRoute(fastify: FastifyInstance) {
  fastify.get(
    "/logs",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Ecosystem Audit Guard"],
        summary: "Query audit logs — own logs for everyone; all logs for SYSTEM ADMINs",
        security: [{ bearerAuth: [] }],
        querystring: AuditQuerySchema,
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(z.any()),
            meta: z.object({ total: z.number(), page: z.number(), limit: z.number() }),
          }),
        },
      },
    },
    async (req, reply) => {
      const query = AuditQuerySchema.parse(req.query);

      // Check if caller is a SYSTEM ADMIN — they can filter by any identity or tenant
      const systemMembership = await fastify.db.tenantMembership.findFirst({
        where: { identityId: req.identity.id, tenantId: "SYSTEM", status: "ACTIVE" },
        include: { role: { select: { name: true } } },
      });
      const isSystemAdmin = systemMembership?.role.name === "ADMIN";

      const auditRepo = new AuditRepository(fastify.db);
      const result = await auditRepo.query({
        identityId: isSystemAdmin ? query.identityId : req.identity.id,
        tenantId: isSystemAdmin ? query.tenantId : undefined,
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