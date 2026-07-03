// src/modules/auth/routes/magic-link.route.ts
// NOTE: This route is mounted under the /auth prefix by auth.plugin.ts
// So these paths become /auth/magic-link/request and /auth/magic-link
import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows";
import { magicLinkFlow } from "../flows/magic-link.flow";
import { z } from "zod";

export async function magicLinkRoute(fastify: FastifyInstance) {
  // POST /auth/magic-link/request
  fastify.post(
    "/magic-link/request",
    {
      config: { rateLimit: { max: 3, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Authentication"],
        summary: "Request a passwordless magic link",
        body: z.object({ email: z.email() }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const { email } = req.body as { email: string };

      const identity = await fastify.db.identity.findUnique({
        where: { primaryEmail: email },
        select: { id: true, primaryEmail: true, name: true },
      });

      // Always return success — never leak whether email exists
      if (!identity?.primaryEmail) return reply.send({ success: true });

      const { EmailTokenService } =
        await import("../services/email-token.service");
      const { notificationService } =
        await import("@/lib/notifications/notification.service");

      const emailTokenService = new EmailTokenService(fastify.db);
      const token = await emailTokenService.issue(
        identity.id,
        "MAGIC_LINK",
        0.25,
      ); // 15 min

      void notificationService.sendMagicLink(identity.primaryEmail, token, {
        name: identity.name ?? undefined,
        ip: req.ip,
      });

      return reply.send({ success: true });
    },
  );

  // POST /auth/magic-link
  fastify.post(
    "/magic-link",
    {
      schema: {
        tags: ["Authentication"],
        summary: "Authenticate via a magic link token",
        body: z.object({ token: z.string().min(1) }),
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(magicLinkFlow, req.body, {
        tenantId: null,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return reply.send({ success: true, data: result });
    },
  );
}
