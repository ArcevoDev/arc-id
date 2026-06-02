import type { FastifyInstance } from "fastify";
import { IntrospectSchema } from "../validators/oauth.schemas";
import { z } from "zod";

export async function introspectRoute(fastify: FastifyInstance) {
  fastify.post(
    "/introspect",
    {
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "RFC 7662 Token Introspection tracking verification",
        body: IntrospectSchema,
        response: {
          200: z.object({
            active: z.boolean(),
            scope: z.string().optional(),
            client_id: z.string().optional(),
            sub: z.string().optional(),
            aud: z.string().optional(),
            iat: z.number().optional(),
            exp: z.number().optional(),
            jti: z.string().optional(),
            token_type: z.string().optional(),
          }),
          401: z.object({ active: z.literal(false) }),
        },
      },
    },
    async (req, reply) => {
      const body = IntrospectSchema.parse(req.body);
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Basic ")) {
        return reply.status(401).send({ active: false });
      }

      const accessToken = await fastify.db.accessToken.findFirst({
        where: { token: body.token, revoked: false },
        include: { identity: true, client: true },
      });

      if (accessToken) {
        const active = accessToken.expiresAt > new Date();
        if (!active) return reply.send({ active: false });

        if (accessToken.jti) {
          const revoked = await fastify.db.revokedJti.findUnique({
            where: { jti: accessToken.jti },
          });
          if (revoked) return reply.send({ active: false });
        }

        return reply.send({
          active: true,
          scope: (accessToken.scopes as string[]).join(" "),
          client_id: accessToken.client.clientId,
          sub: accessToken.identityId,
          aud: accessToken.audience,
          iat: Math.floor(accessToken.issuedAt.getTime() / 1000),
          exp: Math.floor(accessToken.expiresAt.getTime() / 1000),
          jti: accessToken.jti,
          token_type: "Bearer",
        });
      }

      const refreshToken = await fastify.db.refreshToken.findFirst({
        where: { token: body.token, revoked: false },
      });

      if (refreshToken) {
        const active = refreshToken.expiresAt > new Date();
        return reply.send({ active, token_type: "refresh_token" });
      }

      return reply.send({ active: false });
    },
  );
}
