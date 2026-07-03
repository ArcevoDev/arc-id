// src/modules/tenant/routes/invite.route.ts
// POST /invites/accept — consumes a tenant invitation token and activates the membership.
//
// FIX: now uses tokenRecord.tenantId to find the exact membership row.
// Previously used findFirst({ orderBy: createdAt desc }) which could activate
// the wrong tenant's membership if an identity had multiple pending invites.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { EmailTokenService } from "@/modules/auth/services/email-token.service";
import { ApiError } from "@/core/errors";

export async function inviteRoute(fastify: FastifyInstance) {
  fastify.post(
    "/invites/accept",
    {
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "Accept a tenant membership invitation via email token",
        body: z.object({ token: z.string().min(1) }),
        response: {
          200: z.object({
            success: z.literal(true),
            data: z.object({ message: z.string(), tenantSlug: z.string() }),
          }),
          410: z.object({
            success: z.literal(false),
            error: z.string(),
            message: z.string(),
          }),
          404: z.object({
            success: z.literal(false),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { token } = req.body as { token: string };

      // 1. Consume the TENANT_INVITE EmailToken (atomic — marks consumed=true)
      const emailTokenService = new EmailTokenService(fastify.db);
      let tokenRecord: Awaited<ReturnType<typeof emailTokenService.consume>>;

      try {
        tokenRecord = await emailTokenService.consume(token, "TENANT_INVITE");
      } catch {
        return reply.status(410).send({
          success: false,
          error: "INVITE_EXPIRED_OR_USED",
          message:
            "This invitation is invalid, has already been used, or has expired. " +
            "Ask a tenant admin to send a new invite.",
        });
      }

      // 2. Resolve the membership.
      //    FIX: use tokenRecord.tenantId to target the exact membership row.
      //    Falls back to findFirst on identityId if tenantId wasn't stored
      //    (tokens issued before this fix).
      const whereClause = tokenRecord.tenantId
        ? {
            identityId: tokenRecord.identityId,
            tenantId: tokenRecord.tenantId,
            status: "PENDING" as const,
          }
        : { identityId: tokenRecord.identityId, status: "PENDING" as const };

      const membership = await fastify.db.tenantMembership.findFirst({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        include: { tenant: { select: { name: true, slug: true } } },
      });

      if (!membership) {
        // Check if they're already active (e.g. admin activated manually)
        const active = await fastify.db.tenantMembership.findFirst({
          where: {
            identityId: tokenRecord.identityId,
            ...(tokenRecord.tenantId ? { tenantId: tokenRecord.tenantId } : {}),
            status: "ACTIVE",
          },
          orderBy: { createdAt: "desc" },
          include: { tenant: { select: { slug: true } } },
        });

        if (active) {
          return reply.send({
            success: true,
            data: {
              message: "You are already an active member of this organisation",
              tenantSlug: active.tenant.slug,
            },
          });
        }

        return reply.status(404).send({
          success: false,
          error: "MEMBERSHIP_NOT_FOUND",
          message:
            "No pending invitation was found for your account. " +
            "The membership may have been removed by an admin.",
        });
      }

      // 3. Activate the membership
      await fastify.db.tenantMembership.update({
        where: { id: membership.id },
        data: { status: "ACTIVE" },
      });

      return reply.send({
        success: true,
        data: {
          message: `You have joined ${membership.tenant.name}`,
          tenantSlug: membership.tenant.slug,
        },
      });
    },
  );
}
