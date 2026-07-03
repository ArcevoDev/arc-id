// src/modules/identity/routes/oauth-link.route.ts
// FIXED: paths had /me/ prefix inside /identity scope → /identity/me/linked-accounts
// Correct paths now: /identity/linked-accounts
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function oauthLinkRoute(fastify: FastifyInstance) {
  fastify.get(
    "/linked-accounts",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "List linked OAuth providers",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(
              z.object({
                id: z.string(),
                identityId: z.string(),
                provider: z.string(),
                providerUserId: z.string(),
                createdAt: z.coerce.string(),
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
    "/linked-accounts/:id",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "Unlink provider",
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ success: z.boolean() }) },
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
