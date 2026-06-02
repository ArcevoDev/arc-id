import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { issueCredentialFlow } from "../flows/issue-credential.flow";
import { z } from "zod";

export async function issueRoute(fastify: FastifyInstance) {
  fastify.post(
    "/issue",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Verifiable Credentials Engine"],
        summary: "Issue signed digital cryptographic credentials",
        description:
          "Generates cryptographically signed assertions/claims under an authorized identity profile or tenant authority.",
        security: [{ bearerAuth: [] }],
        body: z.any(), // Flexible payload schema matching claim attributes
        response: {
          201: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(issueCredentialFlow, req.body, {
        userId: req.identity.id,
        tenantId: req.identity.tenantId,
        ip: req.ip,
      });
      return reply.status(201).send({ success: true, data: result });
    },
  );
}
