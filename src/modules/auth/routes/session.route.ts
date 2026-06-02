import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function sessionRoute(fastify: FastifyInstance) {
  fastify.get(
    "/sessions",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Session Infrastructure"],
        summary: "List active browser/device authentication records",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(
              z.object({
                id: z.string().uuid(),
                identityId: z.string().uuid(),
                userAgent: z.string().nullable(),
                ip: z.string().nullable(),
                valid: z.boolean(),
                createdAt: z.date(),
              }),
            ),
          }),
        },
      },
    },
    async (req, reply) => {
      const sessions = await fastify.db.session.findMany({
        where: { identityId: req.identity.id, valid: true },
        orderBy: { createdAt: "desc" },
      });
      return reply.send({ success: true, data: sessions });
    },
  );

  fastify.delete(
    "/sessions/:id",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Session Infrastructure"],
        summary: "Invalidate/revoke a distinct user session entry",
        security: [{ bearerAuth: [] }],
        params: z.object({
          id: z.string().uuid("Invalid session tracking key standard format"),
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
      await fastify.db.session.updateMany({
        where: { id, identityId: req.identity.id },
        data: { valid: false },
      });
      return reply.send({ success: true });
    },
  );
}
