// src/modules/identity/routes/admin.route.ts

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { auditService } from "@/modules/audit/services/audit.service";
import { ApiError } from "@/core/errors";
import type { AuditLogAction } from "@/prisma-client";

async function requireSystemAdmin(
  fastify: FastifyInstance,
  identityId: string,
) {
  const m = await fastify.db.tenantMembership.findFirst({
    where: { identityId, tenantId: "SYSTEM", status: "ACTIVE" },
    include: { role: { select: { name: true } } },
  });
  if (!m || m.role.name !== "ADMIN")
    throw ApiError.forbidden("System administrator access required");
}

async function revokeAllSessions(
  fastify: FastifyInstance,
  identityId: string,
): Promise<void> {
  await fastify.db.$transaction([
    fastify.db.refreshToken.updateMany({
      where: { identityId, revoked: false },
      data: { revoked: true, rotatedAt: new Date() },
    }),
    fastify.db.session.updateMany({
      where: { identityId, valid: true },
      data: { valid: false },
    }),
  ]);
}

/**
 * Map a restrictive status change to the correct AuditLogAction.
 * Returns null for ACTIVE (reactivation) — no enum member exists for it;
 * caller omits the audit log rather than logging a misleading action.
 */
function statusToAuditAction(status: string): AuditLogAction | null {
  switch (status) {
    case "SUSPENDED":
      return "IDENTITY_SUSPENDED";
    case "BANNED":
      return "IDENTITY_BANNED";
    default:
      // ACTIVE reinstatement — no corresponding audit action in the enum.
      // Log nothing rather than log a wrong action.
      return null;
  }
}

export async function adminRoute(fastify: FastifyInstance) {
  // GET /identity/admin
  fastify.get(
    "/admin",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "Admin: list identities",
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(100).default(20),
          page: z.coerce.number().int().min(1).default(1),
          status: z
            .enum(["ACTIVE", "SUSPENDED", "BANNED", "PENDING", "DELETED"])
            .optional(),
          search: z.string().optional(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(z.any()),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              limit: z.number(),
            }),
          }),
        },
      },
    },
    async (req, reply) => {
      await requireSystemAdmin(fastify, req.identity.id);
      const { limit, page, status, search } = req.query as any;
      const where: any = {};
      if (status) where.status = status;
      if (search)
        where.OR = [
          { primaryEmail: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ];
      const [identities, total] = await Promise.all([
        fastify.db.identity.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            primaryEmail: true,
            name: true,
            status: true,
            emailVerified: true,
            createdAt: true,
          },
        }),
        fastify.db.identity.count({ where }),
      ]);
      return reply.send({
        success: true,
        data: identities,
        meta: { total, page, limit },
      });
    },
  );

  // POST /identity/admin/:id/suspend
  fastify.post(
    "/admin/:id/suspend",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "Admin: suspend identity",
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        body: z.object({ reason: z.string().optional() }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      await requireSystemAdmin(fastify, req.identity.id);
      const { id } = req.params as any;
      const { reason } = req.body as any;

      const identity = await fastify.db.identity.update({
        where: { id },
        data: { status: "SUSPENDED" },
        select: { primaryEmail: true, name: true },
      });

      await revokeAllSessions(fastify, id);

      if (identity.primaryEmail) {
        const { notificationService } =
          await import("@/lib/notifications/notification.service");
        void notificationService
          .sendAccountSuspended(identity.primaryEmail, {
            name: identity.name ?? undefined,
            reason,
          })
          .catch(() => {});
      }
      await auditService.log({
        action: "IDENTITY_SUSPENDED",
        identityId: id,
        ip: req.ip ?? "0.0.0.0",
        metadata: { reason },
      });
      return reply.send({ success: true });
    },
  );

  // PATCH /identity/:id/status
  fastify.patch(
    "/:id/status",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "Admin: update identity status",
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        body: z.object({
          status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
          reason: z.string().optional(),
        }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      await requireSystemAdmin(fastify, req.identity.id);
      const { id } = req.params as any;
      const { status, reason } = req.body as any;

      const identity = await fastify.db.identity.update({
        where: { id },
        data: { status },
        select: { primaryEmail: true, name: true },
      });

      if (status === "SUSPENDED" || status === "BANNED") {
        await revokeAllSessions(fastify, id);
      }

      if (status === "SUSPENDED" && identity.primaryEmail) {
        const { notificationService } =
          await import("@/lib/notifications/notification.service");
        void notificationService
          .sendAccountSuspended(identity.primaryEmail, {
            name: identity.name ?? undefined,
            reason,
          })
          .catch(() => {});
      }

      // Only log when a real restrictive action enum member exists.
      // ACTIVE reinstatement has no enum counterpart — omit rather than mislog.
      const auditAction = statusToAuditAction(status);
      if (auditAction) {
        await auditService.log({
          action: auditAction,
          identityId: id,
          ip: req.ip ?? "0.0.0.0",
          metadata: { status, reason },
        });
      }

      return reply.send({ success: true });
    },
  );
}
