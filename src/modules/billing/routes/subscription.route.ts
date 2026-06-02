import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { upgradePlanFlow } from "../flows/upgrade-plan.flow";
import { presentSubscription } from "../presenters/subscription.presenter";
import { z } from "zod";

export async function subscriptionRoute(fastify: FastifyInstance) {
  fastify.get(
    "/subscription",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Billing & Subscriptions"],
        summary: "Retrieve active plan tier for current identity context",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.any().nullable(),
          }),
        },
      },
    },
    async (req, reply) => {
      const sub = await fastify.db.subscription.findFirst({
        where: { identityId: req.identity.id, status: "ACTIVE" },
        orderBy: { startedAt: "desc" },
      });
      return reply.send({
        success: true,
        data: sub ? presentSubscription(sub) : null,
      });
    },
  );

  fastify.post(
    "/subscription/upgrade",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Billing & Subscriptions"],
        summary: "Upgrade workspace architecture plan properties",
        security: [{ bearerAuth: [] }],
        body: z.object({
          planId: z.string(), // e.g., premium-tenant-tier
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
      const result = await flowExecutor.run(upgradePlanFlow, req.body, {
        userId: req.identity.id,
        tenantId: null,
      });
      return reply.send({ success: true, data: result });
    },
  );
}
