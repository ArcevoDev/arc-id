// src/modules/credentials/routes/revoke.route.ts
import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows";
import { revokeCredentialFlow } from "../flows/revoke-credential.flow";
import { z } from "zod";

export async function revokeRoute(fastify: FastifyInstance) {
  fastify.post(
    "/revoke",
    {
      // PRO: Credential revocation requires PRO — it's part of the VC lifecycle
      // that only PRO/ENTERPRISE tenants can issue in the first place.
      preHandler: [
        fastify.auth.requirePlan("PRO"),
        fastify.auth.requirePermission("credential:issue"),
      ],
      schema: {
        tags: ["Verifiable Credentials Engine"],
        summary: "Revoke a previously issued credential (PRO)",
        description:
          "Flags a previously issued credential as revoked within the internal ledger " +
          "and updates the public BitstringStatusList index. Requires a PRO or ENTERPRISE subscription.",
        security: [{ bearerAuth: [] }],
        body: z.object({
          credentialId: z.string().uuid({
            message: "Invalid tracking identification format standards",
          }),
        }),
        response: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    async (req, reply) => {
      await flowExecutor.run(revokeCredentialFlow, req.body, {
        identityId: req.identity.id,
        tenantId: req.identity.tenantId,
      });
      return reply.send({ success: true });
    },
  );
}
