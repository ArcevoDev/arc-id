// src/modules/identity/routes/profile.route.ts
// NOTE: Routes are at /me (no prefix change needed — identity plugin has no prefix by design)
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { presentIdentity } from "../presenters/identity.presenter";

export async function profileRoute(fastify: FastifyInstance) {
  // GET /me
  fastify.get(
    "/me",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity & Profile"],
        summary: "Retrieve canonical identity profile with tenant memberships and roles",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
        },
      },
    },
    async (req, reply) => {
      // FIXED: was missing { include: { memberships: { include: { role: true } } } }
      // causing roles to always return []
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
          // Surface active tenant memberships with role names
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

  // PATCH /me
  fastify.patch(
    "/me",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity & Profile"],
        summary: "Update display name and profile picture",
        security: [{ bearerAuth: [] }],
        body: z.object({
          name: z.string().min(1).max(100).optional(),
          picture: z.string().url().optional(),
        }),
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
        },
      },
    },
    async (req, reply) => {
      const body = req.body as { name?: string; picture?: string };
      const identity = await fastify.db.identity.update({
        where: { id: req.identity.id },
        data: body,
        include: {
          memberships: {
            where: { status: "ACTIVE" },
            include: { role: true },
          },
        },
      });

      await fastify.db.auditLog.create({
        data: {
          actionId: "PROFILE_UPDATED",
          identityId: req.identity.id,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          metadata: Object.keys(body),
        },
      });

      return reply.send({ success: true, data: presentIdentity(identity) });
    },
  );

  // DELETE /me
  fastify.delete(
    "/me",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity & Profile"],
        summary: "Initiate account deletion — revokes all sessions and schedules cleanup",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ success: z.boolean(), message: z.string() }),
        },
      },
    },
    async (req, reply) => {
      const identityId = req.identity.id;

      // Get email for notification before deletion
      const identity = await fastify.db.identity.findUniqueOrThrow({
        where: { id: identityId },
        select: { primaryEmail: true, name: true },
      });

      // 1. Revoke all active sessions
      await fastify.db.session.updateMany({
        where: { identityId, valid: true },
        data: { valid: false },
      });

      // 2. Revoke all active tokens
      await fastify.db.accessToken.updateMany({
        where: { identityId, revoked: false },
        data: { revoked: true },
      });
      await fastify.db.refreshToken.updateMany({
        where: { identityId, revoked: false },
        data: { revoked: true },
      });

      // 3. Mark identity as DELETED (soft delete — retains audit trail)
      await fastify.db.identity.update({
        where: { id: identityId },
        data: { status: "DELETED" },
      });

      // 4. Audit log
      await fastify.db.auditLog.create({
        data: {
          actionId: "USER_DELETED",
          identityId,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        },
      });

      // 5. Notify
      if (identity.primaryEmail) {
        const { notificationService } = await import(
          "@/lib/notifications/notification.service"
        );
        void notificationService.sendAccountDeletion(identity.primaryEmail, {
          name: identity.name ?? undefined,
          graceDays: 30,
        });
      }

      return reply.send({
        success: true,
        message: "Account deletion initiated. Your data will be purged within 30 days.",
      });
    },
  );
}