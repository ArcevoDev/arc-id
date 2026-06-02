import type { FastifyInstance } from "fastify";
import { FlowExecutor } from "@/core/flows/flow-executor"; // Use Class constructor pattern
import { updateProfileFlow } from "../flows/update-profile.flow";
import { presentIdentity } from "../presenters/identity.presenter";
import { z } from "zod";

export async function profileRoute(fastify: FastifyInstance) {
  // Instantiate FlowExecutor class at the plugin root level
  const flowExecutor = new FlowExecutor();

  // 1. GET ROUTE
  fastify.get(
    "/me",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "Retrieve authenticated identity profile context",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
    async (req, reply) => {
      const identity = await fastify.db.identity.findUniqueOrThrow({
        where: { id: req.identity.id },
        include: {
          memberships: {
            where: { status: "ACTIVE" },
            include: { role: true },
          },
        },
      });

      return reply.send({
        success: true,
        data: presentIdentity(identity),
      });
    }, // <-- Properly closed the GET handler function block
  ); // <-- Properly closed the GET route registration call

  // 2. PATCH ROUTE
  fastify.patch(
    "/me",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "Modify profile context parameters",
        security: [{ bearerAuth: [] }],
        body: z.object({
          name: z.string().optional(),
          metadata: z.record(z.string(), z.any()).optional(),
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
      const result = await flowExecutor.run(updateProfileFlow, req.body, {
        userId: req.identity.id,
        tenantId: req.identity.tenantId,
      });

      return reply.send({ success: true, data: result });
    },
  );

  fastify.delete(
    "/me",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "Permanently delete account (30-day grace period)",
        security: [{ bearerAuth: [] }],
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const { deleteAccountFlow } =
        await import("../flows/delete-account.flow");
      await flowExecutor.run(
        deleteAccountFlow,
        {},
        {
          userId: req.identity.id,
          tenantId: req.identity.tenantId,
          ip: req.ip,
        },
      );
      return reply.send({ success: true });
    },
  );
}
