// src/modules/oauth/routes/userinfo.route.ts
// FIX: sub was z.string().uuid() — identities use cuid → serializer threw on every /userinfo call
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function userinfoRoute(fastify: FastifyInstance) {
  fastify.get(
    "/userinfo",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "OIDC UserInfo endpoint",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            sub: z.string(), // FIX: was z.string().uuid() — identities are cuid
            email: z.string().nullable(),
            email_verified: z.boolean(),
            name: z.string().nullable(),
            picture: z.string().nullable(),
            plan: z.string(),
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
        plan: req.identity.plan,
      });
    },
  );
}
