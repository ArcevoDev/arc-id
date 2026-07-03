// src/modules/auth/routes/step-up.route.ts
//
// POST /auth/step-up
//
// Re-authenticates the current session to grant a short-lived elevation window
// (15 min) for privileged operations guarded by `requireElevated`.
//
// Flow:
//   1. Client hits a route protected by requireElevated → gets 403 STEP_UP_REQUIRED
//   2. Client POSTs here with their credential
//   3. On success, the session gains elevatedAt = now()
//   4. Client retries the original request within the 15-min window
//
// The JWT is NOT rotated — the existing token is still used. The session row
// change is what the requireElevated guard reads.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { StepUpService } from "../services/step-up.service";
import { auditService } from "@/modules/audit/services/audit.service";
import { ApiError } from "@/core/errors";

const StepUpBodySchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("password"),
    sessionId: z.string().min(40).max(128),
    password: z.string().min(1),
  }),
  z.object({
    method: z.literal("totp"),
    sessionId: z.string().min(40).max(128),
    totpCode: z.string().length(6),
  }),
  z.object({
    method: z.literal("passkey"),
    sessionId: z.string().min(40).max(128),
    passkeyResponse: z.record(z.string(), z.unknown()),
    passkeyChallengeId: z.string().uuid(),
  }),
]);

export async function stepUpRoute(fastify: FastifyInstance) {
  fastify.post(
    "/step-up",
    {
      preHandler: fastify.auth.requireUser,
      config: { rateLimit: { max: 5, timeWindow: "5 minutes" } },
      schema: {
        tags: ["Authentication"],
        summary:
          "Re-authenticate to elevate the current session for privileged operations",
        description:
          "Call this when a route returns 403 STEP_UP_REQUIRED. " +
          "Elevates the session for 15 minutes. " +
          "Supported methods: password, totp, passkey.",
        security: [{ bearerAuth: [] }],
        body: StepUpBodySchema,
        response: {
          200: z.object({
            success: z.literal(true),
            elevatedUntil: z
              .string()
              .describe("ISO-8601 timestamp when elevation expires"),
          }),
        },
      },
    },
    async (req, reply) => {
      const body = req.body as z.infer<typeof StepUpBodySchema>;
      const identityId = req.identity.id;

      // Ensure the session in the request body belongs to the authenticated user.
      // This prevents one user from elevating another user's session.
      const session = await fastify.db.session.findFirst({
        where: {
          id: body.sessionId,
          identityId,
          valid: true,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });

      if (!session) {
        throw ApiError.forbidden("Session not found or does not belong to you");
      }

      const stepUpService = new StepUpService(fastify.db);

      await stepUpService.verify({
        sessionId: body.sessionId,
        identityId,
        method: body.method,
        password: "password" in body ? body.password : undefined,
        totpCode: "totpCode" in body ? body.totpCode : undefined,
        passkeyResponse:
          "passkeyResponse" in body ? body.passkeyResponse : undefined,
        passkeyChallengeId:
          "passkeyChallengeId" in body ? body.passkeyChallengeId : undefined,
      });

      // FIX: Correctly completed object mapping, closed the log execution context,
      // and bound the background worker error catching branch cleanly.
      void auditService
        .log({
          action: "SESSION_ELEVATED",
          identityId,
          ip: req.ip,
          metadata: { stepUpMethod: body.method, sessionId: body.sessionId },
        })
        .catch(() => {});

      const elevatedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      return reply.send({ success: true, elevatedUntil });
    },
  );
}
