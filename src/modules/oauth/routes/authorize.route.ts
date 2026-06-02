import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { authorizeFlow } from "../flows/authorize.flow";
import { z } from "zod";

export async function authorizeRoute(fastify: FastifyInstance) {
  fastify.get(
    "/authorize",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "OAuth2 authorization landing request endpoint",
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          client_id: z.string().min(1),
          response_type: z.string().default("code"),
          redirect_uri: z.string().url(),
          scope: z.string().optional(),
          state: z.string().optional(),
          code_challenge: z.string().optional(),
          code_challenge_method: z.enum(["S256", "plain"]).default("S256"),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(
        authorizeFlow,
        req.query,
        {
          userId: req.identity.id,
          tenantId: req.identity.tenantId,
          ip: req.ip,
        },
        { transaction: false },
      );
      return reply.send({ success: true, data: result });
    },
  );
}
