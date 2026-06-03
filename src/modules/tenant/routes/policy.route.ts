// src/modules/tenant/routes/policy.route.ts
// NOTE: Mounted under /tenants prefix — full paths are /tenants/:tenantId/policy
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { TenantService } from "../services/tenant.service";

export async function policyRoute(fastify: FastifyInstance) {
  // GET /tenants/:tenantId/policy
  fastify.get(
    "/:tenantId/policy",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "Get the current policy configuration for this tenant",
        security: [{ bearerAuth: [] }],
        // FIXED: was z.string().uuid()
        params: z.object({ tenantId: z.string().cuid() }),
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.params as { tenantId: string };

      const tenantService = new TenantService(fastify.db);
      await tenantService.assertMembership(tenantId, req.identity.id);

      const policy = await fastify.db.tenantPolicy.findFirst({
        where: { tenantId },
      });

      return reply.send({ success: true, data: policy ?? null });
    },
  );

  // PATCH /tenants/:tenantId/policy
  fastify.patch(
    "/:tenantId/policy",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary:
          "Update policy configuration — MFA enforcement, session TTL, allowed domains",
        security: [{ bearerAuth: [] }],
        params: z.object({ tenantId: z.string().cuid() }),
        body: z.object({
          requireMfa: z.boolean().optional(),
          sessionTtlMinutes: z.number().int().min(5).max(10080).optional(),
          allowedEmailDomains: z.array(z.string()).optional(),
          maxSessionsPerUser: z.number().int().min(1).max(100).optional(),
          allowPasskeys: z.boolean().optional(),
        }),
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.params as { tenantId: string };
      const body = req.body as Record<string, any>;

      const tenantService = new TenantService(fastify.db);
      await tenantService.assertMembership(tenantId, req.identity.id, "ADMIN");

      // Upsert — create if none exists, update if one does
      const policy = await fastify.db.tenantPolicy.upsert({
        where: { tenantId },
        update: body,
        create: {
          tenantId,
          ...body,
          loginMethods: body.loginMethods ?? {}, // Provide a default if missing
        },
      });

      await fastify.db.auditLog.create({
        data: {
          actionId: "TENANT_POLICY_UPDATED",
          tenantId,
          identityId: req.identity.id,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          metadata: body,
        },
      });

      return reply.send({ success: true, data: policy });
    },
  );
}
