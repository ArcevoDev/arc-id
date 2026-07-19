// src/modules/credentials/routes/issue.route.ts
import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows";
import { issueCredentialFlow } from "../flows/issue-credential.flow";
import { z } from "zod";

export async function issueRoute(fastify: FastifyInstance) {
  fastify.post(
    "/issue",
    {
      // PRO: Verifiable Credential issuance is an enterprise-grade capability.
      // FREE tenants receive a 402 with upgrade guidance.
      preHandler: [
        fastify.auth.requirePlan("PRO"),
        fastify.auth.requirePermission("credential:issue"),
      ],
      schema: {
        tags: ["Verifiable Credentials Engine"],
        summary: "Issue signed digital cryptographic credentials (PRO)",
        description:
          "Generates cryptographically signed assertions/claims under an authorized " +
          "identity profile or tenant authority. Requires a PRO or ENTERPRISE subscription.",
        security: [{ bearerAuth: [] }],
        body: z.any(),
        response: {
          201: z.object({ success: z.boolean(), data: z.any() }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(issueCredentialFlow, req.body, {
        identityId: req.identity.id,
        tenantId: req.identity.tenantId,
        ip: req.ip,
      });
      return reply.status(201).send({ success: true, data: result });
    },
  );
}
