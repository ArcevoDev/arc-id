import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { switchContextFlow } from "../flows/switch-context.flow";
import { SwitchContextSchema } from "../validators/auth.schemas";

export async function switchContextRoute(fastify: FastifyInstance) {
  fastify.post(
    "/switch-context",
    {
      schema: {
        tags: ["Authentication"],
        summary: "Switch tenant context",
        body: SwitchContextSchema,
      },
    },
    async (req, reply) => {
      // Ensure you pass the session/userId into the context here
      const result = await flowExecutor.run(
        switchContextFlow,
        req.body as any,
        {
          tenantId: null, // We are switching TO a new one
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          // metadata: { sessionId: req.session.id } // Map your session ID here
        },
      );
      return reply.send({ success: true, data: result });
    },
  );
}
