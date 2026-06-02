import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function userinfoRoute(fastify: FastifyInstance) {
  fastify.get(
    "/userinfo",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "OIDC profile resource data payload provider mapping",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            sub: z.string().uuid(),
            email: z.string().email(),
            email_verified: z.boolean(),
            name: z.string().nullable(),
            picture: z.string().url().nullable(),
          }),
        },
      },
    },
    async (req, reply) => {
      const identity = await fastify.db.identity.findUniqueOrThrow({
        where: { id: req.identity.id },
      });
      return reply.send({
        sub: identity.id,
        email: identity.primaryEmail,
        email_verified: identity.emailVerified,
        name: identity.name,
        picture: identity.picture,
      });
    },
  );
}
