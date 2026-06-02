import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { logoutFlow } from "../flows/logout.flow";
import { z } from "zod";

export async function logoutRoute(fastify: FastifyInstance) {
  fastify.post(
    "/logout",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Authentication"],
        summary: "Invalidate current user session",
        security: [{ bearerAuth: [] }],
        body: z.object({
          sessionId: z.string().cuid(),
        }),
        response: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    async (req, reply) => {
      const { sessionId } = req.body as { sessionId: string };
      await flowExecutor.run(
        logoutFlow,
        { sessionId },
        {
          userId: req.identity.id,
          tenantId: req.identity.tenantId,
          ip: req.ip,
        },
      );
      return reply.send({ success: true });
    },
  );
}
