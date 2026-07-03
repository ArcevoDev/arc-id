// src/modules/oauth/routes/authorize.route.ts
import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows";
import { authorizeFlow } from "../flows/authorize.flow";
import { z } from "zod";

export async function authorizeRoute(fastify: FastifyInstance) {
  fastify.get(
    "/authorize",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth 2.0 / OIDC Protocol"],
        summary: "OAuth2 authorization endpoint",
        description: [
          "Issues an authorization code for a registered OAuth client.",
          "",
          "**PKCE:** Required for all public clients (`requirePkce: true`).",
          "",
          "**prompt parameter:**",
          "- `none` — do not show any UI; return `login_required` or `consent_required` if interaction is needed",
          "- `login` — force re-authentication even with a valid session",
          "- `consent` — force the consent screen regardless of existing grants",
          "- `select_account` — treated as `login` (multi-account not supported)",
          "",
          "**max_age:** If the current session is older than `max_age` seconds, returns `interaction_required`.",
        ].join("\n"),
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          client_id: z.string().min(1),
          response_type: z.string().default("code"),
          redirect_uri: z.string().url(),
          scope: z.string().optional(),
          state: z.string().optional(),
          nonce: z.string().optional(),
          code_challenge: z.string().optional(),
          code_challenge_method: z.enum(["S256", "plain"]).default("S256"),
          // OIDC Core prompt and max_age
          prompt: z
            .enum(["none", "login", "consent", "select_account"])
            .optional(),
          max_age: z.coerce.number().int().nonnegative().optional(),
        }),
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
          400: z.object({
            success: z.boolean(),
            error: z.string(),
            code: z.string().optional(), // OIDC error code e.g. "login_required"
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(
        authorizeFlow,
        req.query,
        {
          identityId: req.identity.id,
          tenantId: req.identity.tenantId,
          ip: req.ip,
        },
        { transaction: false },
      );
      return reply.send({ success: true, data: result });
    },
  );
}
