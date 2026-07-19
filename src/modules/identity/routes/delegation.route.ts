// src/modules/identity/routes/delegation.route.ts
//
// Delegation endpoints — planned feature, not yet implemented.
// Registered here so identity.plugin.ts can import it without a missing-
// module TS error. Returns 501 consistently with other planned-feature
// stubs in the codebase (social OAuth, IDP federation).
//
// When implementing: delegations allow an identity to grant a limited
// set of OAuth scopes to another identity (or service) without sharing
// credentials — similar to Google's delegated access model.
// The planned schema: a Delegation model with grantor/grantee identityId,
// scopes[], expiresAt, and revoked.
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function delegationRoute(fastify: FastifyInstance) {
  // GET /identity/delegations — list delegations granted by this identity
  fastify.get(
    "/delegations",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity"],
        summary:
          "List delegations granted by this identity [not yet implemented]",
        security: [{ bearerAuth: [] }],
        response: {
          501: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
    async (_req, reply) => {
      return reply.status(501).send({
        error: "NOT_IMPLEMENTED",
        message: "Delegation grants are not yet available.",
      });
    },
  );

  // POST /identity/delegations — create a new delegation grant
  fastify.post(
    "/delegations",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity"],
        summary: "Create a delegation grant [not yet implemented]",
        security: [{ bearerAuth: [] }],
        response: {
          501: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
    async (_req, reply) => {
      return reply.status(501).send({
        error: "NOT_IMPLEMENTED",
        message: "Delegation grants are not yet available.",
      });
    },
  );

  // DELETE /identity/delegations/:id — revoke a delegation
  fastify.delete(
    "/delegations/:id",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity"],
        summary: "Revoke a delegation grant [not yet implemented]",
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        response: {
          501: z.object({ error: z.string(), message: z.string() }),
        },
      },
    },
    async (_req, reply) => {
      return reply.status(501).send({
        error: "NOT_IMPLEMENTED",
        message: "Delegation grants are not yet available.",
      });
    },
  );
}
