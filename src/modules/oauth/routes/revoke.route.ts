import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { tokenRevokeFlow } from "../flows/token-revoke.flow";
import { z } from "zod";

export async function revokeRoute(fastify: FastifyInstance) {
  fastify.post(
    "/revoke",
    {
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "RFC 7009 OAuth token revocation mechanism",
        body: z.object({
          token: z.string().min(1),
          token_type_hint: z.enum(["access_token", "refresh_token"]).optional(),
        }),
        response: {
          200: z.object({}),
        },
      },
    },
    async (req, reply) => {
      await flowExecutor.run(tokenRevokeFlow, req.body, {
        tenantId: null,
        ip: req.ip,
      });
      return reply.status(200).send({});
    },
  );
}
