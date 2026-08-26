import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows";
import { tokenExchangeFlow } from "../flows/token-exchange.flow";
import { tokenRefreshFlow } from "../flows/token-refresh.flow";
import {
  presentTokenResponse,
  presentActiveToken,
} from "../presenters/token.presenter";
import { revokeTokenByIdFlow } from "../flows/revoke-token-by-id.flow";
import { commonErrorSchema } from "@/core/errors/error-schemas";
import { z } from "zod";
import { setRefreshCookie } from "@/lib/refresh-cookies";

export async function tokensRoute(fastify: FastifyInstance) {
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
          400: commonErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const body = req.body as any;
      let result;

      if (body?.grant_type === "refresh_token") {
        // When refresh_token is empty (first-party browser SDK), read the
        // refresh token from the httpOnly cookie instead — this keeps the
        // token out of localStorage and unreachable by JS.
        const refreshToken =
          body?.refresh_token || (req.cookies as any)?.arcid_refresh_token;
        if (!refreshToken) {
          return reply.code(400).send({
            success: false,
            error: "invalid_grant",
            error_description: "Refresh token is required",
          });
        }
        result = await flowExecutor.run(tokenRefreshFlow, {
          ...body,
          refresh_token: refreshToken,
        }, {
          tenantId: null,
          ip: req.ip,
        });
      } else {
        result = await flowExecutor.run(tokenExchangeFlow, body, {
          tenantId: null,
          ip: req.ip,
        });
      }

      const response = presentTokenResponse(result as any);
      // Set refresh token as httpOnly cookie on every token issuance.
      if (response.refresh_token) {
        setRefreshCookie(reply, response.refresh_token);
      }
      return reply.send(response);
    },
  );

  // GET /tokens
  fastify.get(
    "/tokens",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "List the caller's active access tokens",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ success: z.boolean(), data: z.array(z.any()) }),
        },
      },
    },
    async (req, reply) => {
      const tokens = await fastify.db.accessToken.findMany({
        where: {
          identityId: req.identity.id,
          revoked: false,
          expiresAt: { gt: new Date() },
        },
        include: { client: { select: { name: true } } },
        orderBy: { issuedAt: "desc" },
      });

      return reply.send({
        success: true,
        data: tokens.map(presentActiveToken),
      });
    },
  );

  // DELETE /tokens/:id
  fastify.delete(
    "/tokens/:id",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "Revoke one of the caller's active access tokens by id",
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().cuid() }),
        response: {
          200: z.object({ success: z.boolean() }),
          404: commonErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      await flowExecutor.run(
        revokeTokenByIdFlow,
        { id },
        {
          identityId: req.identity.id,
          tenantId: null,
          ip: req.ip,
        },
      );

      return reply.send({ success: true });
    },
  );
}
