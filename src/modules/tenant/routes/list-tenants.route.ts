// src/modules/tenant/routes/list-tenants.route.ts
//
// GET /api/v1/tenants — list all organisations the authenticated user
// has an ACTIVE membership in. Returns enriched tenant data including
// the user's role within each tenant.
//
// No Flow needed: this is a simple read query with no side effects,
// no transaction, and no complex business logic.

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

export async function listTenantsRoute(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "List organisations you belong to",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                slug: z.string(),
                sector: z.string().nullable(),
                plan: z.string(),
                role: z.string(),
                createdAt: z.string(),
              }),
            ),
          }),
        },
      },
    },
    async (req, reply) => {
      const memberships = await fastify.db.tenantMembership.findMany({
        where: { identityId: req.identity.id, status: "ACTIVE" },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              sector: true,
              createdAt: true,
              subscription: { select: { plan: true } },
            },
          },
          role: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      return reply.send({
        success: true,
        data: memberships.map((m) => ({
          id: m.tenant.id,
          name: m.tenant.name,
          slug: m.tenant.slug,
          sector: m.tenant.sector,
          plan: m.tenant.subscription?.plan ?? "FREE",
          role: m.role.name,
          createdAt: m.tenant.createdAt.toISOString(),
        })),
      });
    },
  );
}
