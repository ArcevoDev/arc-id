// src/modules/auth/routes/password.route.ts
import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows";
import { passwordResetRequestFlow } from "../flows/password-reset-request.flow";
import { passwordResetConfirmFlow } from "../flows/password-reset-confirm.flow";
import { verifyPassword, hashPassword } from "../services/password.service";
import { notificationService } from "@/lib/notifications/notification.service";
import { auditService } from "@/modules/audit/services/audit.service";
import { ApiError } from "@/core/errors";
import { z } from "zod";

export async function passwordRoute(fastify: FastifyInstance) {
  // ── POST /password/reset — unauthenticated reset request ─────────────────
  fastify.post(
    "/password/reset",
    {
      config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Password Operations"],
        summary: "Trigger a secure password reset request",
        body: z.object({ email: z.email() }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      await flowExecutor.run(passwordResetRequestFlow, req.body, {
        tenantId: null,
        ip: req.ip,
      });
      return reply.send({ success: true });
    },
  );

  // ── POST /password/reset/confirm — consume token and set new password ─────
  fastify.post(
    "/password/reset/confirm",
    {
      schema: {
        tags: ["Password Operations"],
        summary: "Confirm password reset with token",
        body: z.object({
          token: z.string().min(1),
          newPassword: z.string().min(8),
        }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      await flowExecutor.run(passwordResetConfirmFlow, req.body, {
        tenantId: null,
        ip: req.ip,
      });
      return reply.send({ success: true });
    },
  );

  // ── POST /password/change — in-session password change ────────────────────
  fastify.post(
    "/password/change",
    {
      preHandler: fastify.auth.requireElevated,
      config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Password Operations"],
        summary: "Change password — requires step-up re-authentication",
        description:
          "The caller must have a recently elevated session (POST /auth/step-up). " +
          "On success, all other sessions and their refresh tokens are revoked.",
        security: [{ bearerAuth: [] }],
        body: z.object({
          currentPassword: z.string().min(1, "Current password is required"),
          newPassword: z
            .string()
            .min(8, "New password must be at least 8 characters"),
        }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };

      // 1. Load local account
      const localAccount = await fastify.db.localAccount.findUnique({
        where: { identityId: req.identity.id },
        select: { id: true, passwordHash: true },
      });

      if (!localAccount) {
        throw ApiError.badRequest(
          "No password set for this account — use /password/reset to create one",
        );
      }

      // 2. Verify current password
      const currentValid = await verifyPassword(
        localAccount.passwordHash,
        currentPassword,
      );

      if (!currentValid) {
        void auditService
          .log({
            action: "PASSWORD_CHANGED",
            identityId: req.identity.id,
            ip: req.ip,
            metadata: { outcome: "FAILED_INCORRECT_CURRENT_PASSWORD" },
          })
          .catch(() => {});
        throw ApiError.unauthorized("Current password is incorrect");
      }

      // 3. Reject no-op change
      if (currentPassword === newPassword) {
        throw ApiError.badRequest(
          "New password must differ from the current password",
        );
      }

      // 4. Hash and persist the new password
      const newHash = await hashPassword(newPassword);
      await fastify.db.localAccount.update({
        where: { id: localAccount.id },
        data: { passwordHash: newHash, passwordUpdatedAt: new Date() },
      });

      // 5. Revoke all OTHER sessions and their refresh tokens.
      //
      // FIX (Bug 3): Previous implementation only set session.valid = false
      // for the other sessions. Their bound refresh tokens remained live for
      // up to 7 days — an attacker with any intercepted refresh token could
      // keep rotating it even after the user changed their password.
      //
      // Fix: collect the other session IDs, then atomically revoke both their
      // refresh tokens (via back-reference RefreshToken.sessionId) and the
      // sessions themselves.
      const payload = req.user as any;
      const currentSessionId = payload?.sid as string | undefined;

      const otherSessions = await fastify.db.session.findMany({
        where: {
          identityId: req.identity.id,
          valid: true,
          ...(currentSessionId ? { NOT: { id: currentSessionId } } : {}),
        },
        select: { id: true },
      });

      if (otherSessions.length > 0) {
        const otherSessionIds = otherSessions.map((s) => s.id);

        await fastify.db.$transaction([
          // Revoke all refresh tokens for the other sessions
          fastify.db.refreshToken.updateMany({
            where: { sessionId: { in: otherSessionIds }, revoked: false },
            data: { revoked: true, rotatedAt: new Date() },
          }),
          // Then invalidate the sessions
          fastify.db.session.updateMany({
            where: { id: { in: otherSessionIds } },
            data: { valid: false },
          }),
        ]);
      }

      // 6. Notify
      const identity = await fastify.db.identity.findUnique({
        where: { id: req.identity.id },
        select: { primaryEmail: true, name: true },
      });

      if (identity?.primaryEmail) {
        void notificationService
          .sendPasswordChanged(identity.primaryEmail, {
            name: identity.name ?? undefined,
            ip: req.ip,
          })
          .catch(() => {});
      }

      void auditService
        .log({
          action: "PASSWORD_CHANGED",
          identityId: req.identity.id,
          ip: req.ip,
        })
        .catch(() => {});

      return reply.send({ success: true });
    },
  );
}
