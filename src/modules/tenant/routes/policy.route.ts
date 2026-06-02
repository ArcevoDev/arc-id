import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function policyRoute(fastify: FastifyInstance) {
  fastify.get(
    "/:tenantId/policy",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary:
          "Evaluate and fetch configuration restrictions assigned to the organization space",
        security: [{ bearerAuth: [] }],
        params: z.object({
          tenantId: z.string().uuid(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.params as { tenantId: string };
      const policy = await fastify.db.tenantPolicy.findFirst({
        where: { tenantId },
      });
      return reply.send({ success: true, data: policy });
    },
  );

  fastify.patch(
    "/:tenantId/policy",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary:
          "Update custom system assertion conditions for the specified tenant space",
        security: [{ bearerAuth: [] }],
        params: z.object({
          tenantId: z.string().uuid(),
        }),
        response: {
          501: z.object({ message: z.string() }),
        },
      },
    },
    async (req, reply) => {
      return reply.status(501).send({ message: "Not yet implemented" });
    },
  );
}
