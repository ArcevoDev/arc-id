// src/modules/identity/routes/profile.route.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma-client";
import { presentIdentity } from "../presenters/identity.presenter";
import { UpdateProfileSchema } from "../validators/identity.schemas";
import { auditService } from "@/modules/audit/services/audit.service";

export async function profileRoute(fastify: FastifyInstance) {
  // GET /profile
  fastify.get(
    "/profile",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity & Profile"],
        summary:
          "Retrieve canonical identity profile with tenant memberships and roles",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
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
        data: {
          ...presentIdentity(identity),
          plan: req.identity.plan,
          tenantId: req.identity.tenantId,
          memberships: identity.memberships.map((m) => ({
            tenantId: m.tenantId,
            role: m.role.name,
            status: m.status,
            joinedAt: m.createdAt,
          })),
        },
      });
    },
  );

  // PATCH /profile — requireUser is sufficient (low-risk mutation)
  fastify.patch(
    "/profile",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity & Profile"],
        summary: "Update display name and profile picture",
        security: [{ bearerAuth: [] }],
        body: UpdateProfileSchema,
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
        },
      },
    },
    async (req, reply) => {
      const body = req.body as z.infer<typeof UpdateProfileSchema>;

      const identity = await fastify.db.identity.update({
        where: { id: req.identity.id },
        data: {
          name: body.name,
          picture: body.picture,
          metadata: body.metadata
            ? (body.metadata as Prisma.InputJsonValue)
            : undefined,
        },
        include: {
          memberships: {
            where: { status: "ACTIVE" },
            include: { role: true },
          },
        },
      });

      void auditService
        .log({
          action: "PROFILE_UPDATED",
          identityId: req.identity.id,
          ip: req.ip,
          metadata: { fields: Object.keys(body) },
        })
        .catch(() => {});

      return reply.send({ success: true, data: presentIdentity(identity) });
    },
  );

  // DELETE /profile
  // requireElevated: destroys the account, all sessions, and all tokens.
  // A compromised bearer token alone is not sufficient — the user must have
  // re-authenticated within the last 15 minutes via POST /auth/step-up.
  fastify.delete(
    "/profile",
    {
      preHandler: fastify.auth.requireElevated,
      schema: {
        tags: ["Identity & Profile"],
        summary:
          "Permanently delete account (requires step-up re-authentication)",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ success: z.boolean(), message: z.string() }),
        },
      },
    },
    async (req, reply) => {
      const identityId = req.identity.id;

      const identity = await fastify.db.identity.findUniqueOrThrow({
        where: { id: identityId },
        select: { primaryEmail: true, name: true },
      });

      // Revoke all live sessions and tokens before deletion
      await fastify.db.$transaction([
        fastify.db.session.updateMany({
          where: { identityId, valid: true },
          data: { valid: false },
        }),
        fastify.db.accessToken.updateMany({
          where: { identityId, revoked: false },
          data: { revoked: true },
        }),
        fastify.db.refreshToken.updateMany({
          where: { identityId, revoked: false },
          data: { revoked: true },
        }),
      ]);

      await fastify.db.identity.delete({ where: { id: identityId } });

      void auditService
        .log({
          action: "USER_DELETED",
          identityId,
          ip: req.ip,
          metadata: { email: identity.primaryEmail },
        })
        .catch(() => {});

      return reply.send({
        success: true,
        message: "Account permanently deleted",
      });
    },
  );
}
