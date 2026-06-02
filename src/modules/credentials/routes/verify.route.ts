import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { verifyCredentialFlow } from "../flows/verify-credential.flow";
import { z } from "zod";

export async function verifyRoute(fastify: FastifyInstance) {
  fastify.post(
    "/verify",
    {
      schema: {
        tags: ["Verifiable Credentials Engine"],
        summary: "Cryptographically verify incoming credential payloads",
        description:
          "Validates digital signatures, checks mathematical tamper resistance, expiration dates, and evaluates the bitstring revocation matrix context.",
        body: z.object({
          credential: z.any(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(
        verifyCredentialFlow,
        req.body,
        { tenantId: null },
        { transaction: false },
      );
      return reply.send({ success: true, data: result });
    },
  );
}
