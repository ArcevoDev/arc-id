import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { tokenExchangeFlow } from "../flows/token-exchange.flow";
import { tokenRefreshFlow } from "../flows/token-refresh.flow";
import { presentTokenResponse } from "../presenters/token.presenter";
import { z } from "zod";

export async function tokenRoute(fastify: FastifyInstance) {
  fastify.post(
    "/token",
    {
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "Issue tokens via standard grant execution sequences",
        body: z.object({
          grant_type: z.string(),
          code: z.string().optional(),
          redirect_uri: z.string().url().optional(),
          client_id: z.string().optional(),
          client_secret: z.string().optional(),
          refresh_token: z.string().optional(),
          code_verifier: z.string().optional(),
        }),
        response: {
          200: z.record(z.string(), z.any()),
        },
      },
    },
    async (req, reply) => {
      const body = req.body as any;
      let result;

      if (body?.grant_type === "refresh_token") {
        result = await flowExecutor.run(tokenRefreshFlow, body, {
          tenantId: null,
          ip: req.ip,
        });
      } else {
        result = await flowExecutor.run(tokenExchangeFlow, body, {
          tenantId: null,
          ip: req.ip,
        });
      }

      return reply.send(presentTokenResponse(result as any));
    },
  );
}
