// src/modules/auth/routes/logout.route.ts

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { flowExecutor } from "@/core/flows";
import { logoutFlow } from "../flows/logout.flow";

const SessionIdSchema = z.string().min(40).max(128);

export async function logoutRoute(fastify: FastifyInstance) {
  fastify.post(
    "/logout",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Authentication"],
        summary: "Invalidate the current authentication session",
        security: [{ bearerAuth: [] }],
        body: z.object({
          sessionId: SessionIdSchema,
        }),

        response: {
          200: z.object({
            success: z.boolean(),
          }),
        },
      },
    },

    async (req, reply) => {
      const { sessionId } = req.body as {
        sessionId: string;
      };

      await flowExecutor.run(
        logoutFlow,
        { sessionId },
        {
          identityId: req.identity.id,
          tenantId: req.identity.tenantId,
          ip: req.ip,
        },
      );

      return reply.send({
        success: true,
      });
    },
  );
}
