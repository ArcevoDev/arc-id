import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { addMemberFlow } from "../flows/add-member.flow";
import { removeMemberFlow } from "../flows/remove-member.flow";
import { AddMemberSchema } from "../validators/tenant.schemas";
import { z } from "zod";

export async function membershipRoute(fastify: FastifyInstance) {
  // ── POST /:tenantId/members ───────────────────────────────────────────────
  fastify.post(
    "/:tenantId/members",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "Bind an identity as a member of an organisation space",
        security: [{ bearerAuth: [] }],
        params: z.object({
          tenantId: z.string().cuid(),
        }),
        /**
         * Body schema references the shared AddMemberSchema so the `role`
         * field is always in sync with the Role DB enum.
         */
        body: AddMemberSchema,
        response: {
          201: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.params as { tenantId: string };
      const result = await flowExecutor.run(
        addMemberFlow,
        { ...(req.body as object), tenantId },
        {
          userId: req.identity.id,
          tenantId,
          ip: req.ip,
        },
      );
      return reply.status(201).send({ success: true, data: result });
    },
  );

  // ── DELETE /:tenantId/members/:identityId ─────────────────────────────────
  fastify.delete(
    "/:tenantId/members/:identityId",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "Remove an identity's membership from the organisation",
        security: [{ bearerAuth: [] }],
        params: z.object({
          tenantId: z.string().cuid(),
          identityId: z.string().cuid(),
        }),
        response: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId, identityId } = req.params as {
        tenantId: string;
        identityId: string;
      };
      await flowExecutor.run(
        removeMemberFlow,
        { tenantId, identityId },
        { userId: req.identity.id, tenantId },
      );
      return reply.send({ success: true });
    },
  );
}
