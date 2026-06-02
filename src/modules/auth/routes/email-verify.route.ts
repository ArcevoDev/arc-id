import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { emailVerifyFlow } from "../flows/email-verify.flow";
import { z } from "zod";

export async function emailVerifyRoute(fastify: FastifyInstance) {
  fastify.post(
    "/email/verify",
    {
      schema: {
        tags: ["Authentication"],
        summary: "Verify an identity email address",
        description:
          "Validates a secure verification token issued during onboarding.",
        body: z.object({
          token: z.string().min(1, "Verification token is required"),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    async (req, reply) => {
      await flowExecutor.run(emailVerifyFlow, req.body, { tenantId: null });
      return reply.send({ success: true });
    },
  );
}
