// src/modules/auth/routes/session.route.ts
// NOTE: Mounted under /auth prefix — full paths are /auth/sessions and /auth/sessions/:id
//
// FIX (Bug 4): refreshToken.updateMany previously had no identityId in its
// WHERE clause, relying only on sessionId. The comment said "ownership check
// via join-like constraint" but no such constraint existed in the actual query.
// Practically unexploitable because session IDs are 64-char random tokens, but
// the gap was real. Fixed by adding identityId to the WHERE so both operations
// in the transaction are explicitly owner-scoped.

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
                authLevel: z.string().nullable(),
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
        summary: "Revoke a specific session and its bound refresh token",
        security: [{ bearerAuth: [] }],
        params: z.object({
          id: z
            .string()
            .min(40, "Invalid session ID")
            .max(128, "Invalid session ID"),
        }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      // Both operations are owner-scoped via identityId so neither can affect
      // a session belonging to a different user, even if the session ID were
      // somehow known to an attacker.
      await fastify.db.$transaction([
        // Revoke all refresh tokens issued for this session, scoped to the
        // requesting identity (closes the ownership gap noted in Bug 4).
        fastify.db.refreshToken.updateMany({
          where: {
            sessionId: id,
            identityId: req.identity.id,
            revoked: false,
          },
          data: { revoked: true, rotatedAt: new Date() },
        }),
        // Invalidate the session itself (ownership enforced here)
        fastify.db.session.updateMany({
          where: { id, identityId: req.identity.id },
          data: { valid: false },
        }),
      ]);

      return reply.send({ success: true });
    },
  );
}
