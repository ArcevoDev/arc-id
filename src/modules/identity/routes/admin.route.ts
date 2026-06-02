import type { FastifyInstance } from "fastify";
// Ensure this is at the top of your file
import { auditService } from "@/modules/audit/services/audit.service";

import { z } from "zod";

export async function adminRoute(fastify: FastifyInstance) {
  fastify.patch(
    "/identities/:id/status",
    {
      preHandler: fastify.auth.requireScope("admin:write"),
      schema: {
        tags: ["Identity Vault"],
        summary: "Admin: update identity status (suspend/ban/restore)",
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().cuid() }),
        body: z.object({
          status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
          reason: z.string().optional(),
        }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { status, reason } = req.body as {
        status: string;
        reason?: string;
      };

      const identity = await fastify.db.identity.update({
        where: { id },
        data: { status: status as any },
        select: { primaryEmail: true, name: true },
      });

      if (status === "SUSPENDED" && identity.primaryEmail) {
        const { notificationService } =
          await import("@/lib/notifications/notification.service");
        void notificationService.sendAccountSuspended(identity.primaryEmail, {
          name: identity.name ?? undefined,
          reason,
        });
      }

      auditService.log({
        action:
          status === "SUSPENDED" ? "IDENTITY_SUSPENDED" : "IDENTITY_DELETED",
        identityId: id,
        ip: req.ip,
      });

      return reply.send({ success: true });
    },
  );
}
