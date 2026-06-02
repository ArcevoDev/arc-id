import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function delegationRoute(fastify: FastifyInstance) {
  fastify.get(
    "/me/delegations",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "List authorized third-party access delegations",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(
              z.object({
                id: z.string().uuid(),
                grantorId: z.string().uuid(),
                delegateId: z.string().uuid(),
                scopes: z.array(z.string()),
                createdAt: z.date(),
              }),
            ),
          }),
        },
      },
    },
    async (req, reply) => {
      const delegations = await fastify.db.accessDelegation.findMany({
        where: { grantorId: req.identity.id },
      });
      return reply.send({ success: true, data: delegations });
    },
  );
}
