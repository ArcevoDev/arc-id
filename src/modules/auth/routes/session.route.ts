// src/modules/auth/routes/session.route.ts
// NOTE: Mounted under /auth prefix — full paths are /auth/sessions and /auth/sessions/:id
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function sessionRoute(fastify: FastifyInstance) {
  // GET /auth/sessions
  fastify.get(
    "/sessions",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Session Infrastructure"],
        summary: "List active browser/device authentication sessions",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(
              z.object({
                id: z.string(),
                identityId: z.string(),
                userAgent: z.string().nullable(),
                ip: z.string().nullable(),
                valid: z.boolean(),
                createdAt: z.coerce.string(),
                expiresAt: z.coerce.string(),
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

  // DELETE /auth/sessions/:id
  fastify.delete(
    "/sessions/:id",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Session Infrastructure"],
        summary: "Revoke a specific session",
        security: [{ bearerAuth: [] }],
        params: z.object({
          // Sessions use cuid() — NOT uuid — fix from previous uuid validation
          id: z.string().cuid("Invalid session ID format"),
        }),
        response: { 200: z.object({ success: z.boolean() }) },
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
