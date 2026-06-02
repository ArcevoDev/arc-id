import type { FastifyInstance } from "fastify";
import { AuditQuerySchema } from "../validators/audit.schemas";
import { AuditRepository } from "../repositories/audit.repository";
import { presentAuditLog } from "../presenters/audit.presenter";
import { z } from "zod";

export async function auditRoute(fastify: FastifyInstance) {
  fastify.get(
    "/logs",
    {
      preHandler: fastify.auth.requireScope("admin:read"),
      schema: {
        tags: ["Ecosystem Audit Guard"],
        summary: "Query system-wide audit ledger logs",
        security: [{ bearerAuth: [] }],
        querystring: AuditQuerySchema, // Integrates pagination rules natively into query docs
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(z.any()), // Map out your specific fields or pass presented model array
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
      const auditRepo = new AuditRepository(fastify.db);

      const result = await auditRepo.query({
        identityId: query.identityId,
        tenantId: query.tenantId,
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
