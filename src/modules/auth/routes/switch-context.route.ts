// src/modules/auth/routes/switch-context.route.ts
// POST /auth/switch-context — allows a logged-in user to issue a new token
// scoped to a specific tenant they belong to.
import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { switchContextFlow } from "../flows/switch-context.flow";
import { SwitchContextSchema } from "../validators/auth.schemas";
import { z } from "zod";

export async function switchContextRoute(fastify: FastifyInstance) {
  fastify.post(
    "/switch-context",
    {
      // FIXED: requireUser was missing — req.identity was undefined, flow always got 401
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Authentication"],
        summary:
          "Switch active tenant context — re-issues token scoped to new tenant",
        description:
          "Allows a user who belongs to multiple tenants to switch their active identity context. " +
          "Returns a new access + refresh token pair with the selected tenant in the `tid` claim.",
        security: [{ bearerAuth: [] }],
        body: SwitchContextSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.object({
              accessToken: z.string(),
              refreshToken: z.string(),
              idToken: z.string().nullable(),
              expiresIn: z.number(),
            }),
          }),
        },
      },
    },
    async (req, reply) => {
      // Pull active session so switch-context can bind to it
      const activeSession = await fastify.db.session.findFirst({
        where: { identityId: req.identity.id, valid: true },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      const result = await flowExecutor.run(
        switchContextFlow,
        req.body as any,
        {
          userId: req.identity.id,
          tenantId: req.identity.tenantId,
          sessionId: activeSession?.id,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        },
      );
      return reply.send({ success: true, data: result });
    },
  );
}
