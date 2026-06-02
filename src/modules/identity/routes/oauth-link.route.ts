import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function oauthLinkRoute(fastify: FastifyInstance) {
  fastify.get(
    "/me/linked-accounts",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "List linked third-party social OAuth references",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(
              z.object({
                id: z.string().uuid(),
                identityId: z.string().uuid(),
                provider: z.string(),
                providerUserId: z.string(),
                createdAt: z.date(),
              }),
            ),
          }),
        },
      },
    },
    async (req, reply) => {
      const accounts = await fastify.db.oAuthAccount.findMany({
        where: { identityId: req.identity.id },
      });
      return reply.send({ success: true, data: accounts });
    },
  );

  fastify.delete(
    "/me/linked-accounts/:id",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "Sever federation link from provider",
        security: [{ bearerAuth: [] }],
        params: z.object({
          id: z.string().uuid("Invalid tracking verification mapping handle"),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      await fastify.db.oAuthAccount.deleteMany({
        where: { id, identityId: req.identity.id },
      });
      return reply.send({ success: true });
    },
  );
}
