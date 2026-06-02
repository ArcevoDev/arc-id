import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { revokeCredentialFlow } from "../flows/revoke-credential.flow";
import { z } from "zod";

export async function revokeRoute(fastify: FastifyInstance) {
  fastify.post(
    "/revoke",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Verifiable Credentials Engine"],
        summary: "Revoke structural issued credential parameters",
        description:
          "Flags a previously issued credential as revoked within the internal ledger and updates the public bitstring status list tracking index.",
        security: [{ bearerAuth: [] }],
        body: z.object({
          credentialId: z
            .string()
            .uuid("Invalid tracking identification format standards"),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    async (req, reply) => {
      await flowExecutor.run(revokeCredentialFlow, req.body, {
        userId: req.identity.id,
        tenantId: req.identity.tenantId,
      });
      return reply.send({ success: true });
    },
  );
}
