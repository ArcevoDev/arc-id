import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { passwordResetRequestFlow } from "../flows/password-reset-request.flow";
import { passwordResetConfirmFlow } from "../flows/password-reset-confirm.flow";
import { z } from "zod";

export async function passwordRoute(fastify: FastifyInstance) {
  fastify.post(
    "/password/reset",
    {
      config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Password Operations"],
        summary: "Trigger a secure password reset request",
        body: z.object({
          email: z.string().email(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    async (req, reply) => {
      await flowExecutor.run(passwordResetRequestFlow, req.body, {
        tenantId: null,
        ip: req.ip,
      });
      return reply.send({ success: true });
    },
  );

  fastify.post(
    "/password/reset/confirm",
    {
      schema: {
        tags: ["Password Operations"],
        summary: "Confirm password alteration sequence",
        body: z.object({
          token: z.string().min(1),
          newPassword: z.string().min(8),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    async (req, reply) => {
      await flowExecutor.run(passwordResetConfirmFlow, req.body, {
        tenantId: null,
        ip: req.ip,
      });
      return reply.send({ success: true });
    },
  );
}
