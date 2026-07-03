// src/modules/oauth/routes/revoke.route.ts
//
// FIX (Bug 3 — route half):
//   1. Added preHandler: fastify.auth.requireUser  — the endpoint previously had
//      no authentication at all. RFC 7009 §2.1 requires client authentication
//      for confidential clients. For our architecture (bearer-token auth) we
//      require the caller to hold a valid access token, which both proves
//      identity and supplies req.identity.id for ownership scoping.
//   2. Pass ctx.identityId into flowExecutor.run so token-revoke.flow.ts can
//      scope its DB queries to the authenticated caller.
//
// Note: RFC 7009 mandates a 200 response even if the token is unknown, so
// the preHandler returning 401 for unauthenticated callers is the correct
// deviation for a confidential-client server. If public-client support is
// needed in the future, add a client_id + client_secret check path here.

import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows";
import { tokenRevokeFlow } from "../flows/token-revoke.flow";
import { z } from "zod";

export async function revokeRoute(fastify: FastifyInstance) {
  fastify.post(
    "/revoke",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "RFC 7009 OAuth token revocation mechanism",
        security: [{ bearerAuth: [] }],
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
        identityId: req.identity.id,
      });
      return reply.status(200).send({});
    },
  );
}
