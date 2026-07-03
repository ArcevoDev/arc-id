// src/modules/tenant/routes/membership.route.ts
import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows";
import { addMemberFlow } from "../flows/add-member.flow";
import { removeMemberFlow } from "../flows/remove-member.flow";
import { AddMemberSchema } from "../validators/tenant.schemas";
import { presentMembershipWithIdentity } from "../presenters/membership.presenter";
import { ApiError } from "@/core/errors";
import { z } from "zod";

// ── Membership gate ─────────────────────────────────────────────────────────
// Mirrors the pattern in tenant.route.ts's GET /:slug: the caller must be an
// ACTIVE member of this tenant, or an ACTIVE member of SYSTEM (platform admin).
// Unlike the slug lookup, the caller already knows tenantId here (it came from
// their own tenant switcher), so 403 (not 404) is the correct response.
async function assertTenantMember(
  fastify: FastifyInstance,
  identityId: string,
  tenantId: string,
) {
  const membership = await fastify.db.tenantMembership.findFirst({
    where: {
      identityId,
      tenantId: { in: [tenantId, "SYSTEM"] },
      status: "ACTIVE",
    },
  });
  if (!membership) {
    throw ApiError.forbidden("You are not a member of this tenant");
  }
}

export async function membershipRoute(fastify: FastifyInstance) {
  // GET /:tenantId/members
  // FIX: this endpoint did not exist — tenantSdk.listMembers() already called it,
  // but the route was never implemented. Returns membership rows enriched with
  // identity email/name/picture (see presentMembershipWithIdentity) so the
  // <MemberRow> component doesn't need a second lookup per row.
  fastify.get(
    "/:tenantId/members",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "List members of an organisation, enriched with identity info",
        security: [{ bearerAuth: [] }],
        params: z.object({ tenantId: z.string().cuid() }),
        response: {
          200: z.object({ success: z.boolean(), data: z.array(z.any()) }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.params as { tenantId: string };

      await assertTenantMember(fastify, req.identity.id, tenantId);

      const memberships = await fastify.db.tenantMembership.findMany({
        where: { tenantId },
        include: {
          role: { select: { name: true } },
          identity: {
            select: { id: true, primaryEmail: true, name: true, picture: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return reply.send({
        success: true,
        data: memberships.map(presentMembershipWithIdentity),
      });
    },
  );

  // POST /:tenantId/members
  fastify.post(
    "/:tenantId/members",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "Bind an identity as a member of an organisation space",
        security: [{ bearerAuth: [] }],
        params: z.object({ tenantId: z.string().cuid() }),
        body: AddMemberSchema,
        response: { 201: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.params as { tenantId: string };
      const result = await flowExecutor.run(
        addMemberFlow,
        { ...(req.body as object), tenantId },
        {
          identityId: req.identity.id,
          tenantId,
          ip: req.ip,
          plan: req.identity.plan, // FIX: was missing — ctx.plan was always undefined
          // → cap always enforced as FREE (3 members)
          // → PRO/ENTERPRISE tenants couldn't invite anyone
        },
      );
      return reply.status(201).send({ success: true, data: result });
    },
  );

  // DELETE /:tenantId/members/:identityId
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
        response: { 200: z.object({ success: z.boolean() }) },
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
        { identityId: req.identity.id, tenantId },
      );
      return reply.send({ success: true });
    },
  );
}
