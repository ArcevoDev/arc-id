// src/modules/auth/routes/mfa.route.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { flowExecutor } from "@/core/flows";
import { mfaVerifyFlow } from "../flows/mfa-verify.flow";
import {
  mfaSetupFlow,
  mfaConfirmFlow,
  disableMfa,
} from "../flows/mfa-setup.flow";
import { TokenService } from "@/modules/oauth/services/token.service";
import { MfaService } from "../services/mfa.service";
import { auditService } from "@/modules/audit/services/audit.service";
import { config } from "@/core/config";
import { ApiError } from "@/core/errors";

const SessionIdSchema = z.string().min(40).max(128);
const DEFAULT_SCOPES = ["openid", "profile", "email", "offline_access"];

export async function mfaRoute(fastify: FastifyInstance) {
  // ── POST /mfa/verify ──────────────────────────────────────────────────────
  fastify.post(
    "/mfa/verify",
    {
      config: { rateLimit: { max: 5, timeWindow: "5 minutes" } },
      schema: {
        tags: ["Multi-Factor Authentication"],
        summary: "Verify TOTP MFA code and finalize login",
        body: z.object({
          code: z.string().length(6),
          sessionId: SessionIdSchema,
        }),
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(mfaVerifyFlow, req.body, {
        tenantId: null,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return reply.send({ success: true, data: result });
    },
  );

  // ── POST /mfa/recovery ────────────────────────────────────────────────────
  fastify.post(
    "/mfa/recovery",
    {
      config: { rateLimit: { max: 3, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Multi-Factor Authentication"],
        summary:
          "Authenticate with a one-time MFA recovery code (lost TOTP device)",
        body: z.object({
          code: z.string().min(8).max(64),
          sessionId: SessionIdSchema,
        }),
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const { code, sessionId } = req.body as {
        code: string;
        sessionId: string;
      };

      const session = await fastify.db.session.findFirst({
        where: { id: sessionId, expiresAt: { gt: new Date() } },
      });
      if (!session) throw ApiError.unauthorized("Session not found or expired");

      const mfaService = new MfaService(fastify.db);
      const consumed = await mfaService.consumeRecoveryCode(
        session.identityId,
        code.trim().toUpperCase(),
      );
      if (!consumed)
        throw ApiError.unauthorized("Invalid or already used recovery code");

      const tokens = await fastify.db.$transaction(async (tx) => {
        await tx.session.update({
          where: { id: session.id },
          data: { valid: true, authLevel: "aal2" },
        });
        const tokenService = new TokenService();
        return tokenService.issue(
          {
            db: tx as any,
            identityId: session.identityId,
            tenantId: "SYSTEM",
          } as any,
          {
            identityId: session.identityId,
            clientId: config.oauth.directClientId,
            sessionId: session.id,
            scopes: DEFAULT_SCOPES,
            audience: [config.oauth.directClientId],
            tenantId: "SYSTEM",
            authLevel: "aal2",
          },
        );
      });

      void auditService
        .log({
          action: "MFA_RECOVERY_USED",
          identityId: session.identityId,
          ip: req.ip ?? "0.0.0.0",
        })
        .catch(() => {});

      return reply.send({
        success: true,
        data: {
          sessionId: session.id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          idToken: tokens.idToken,
          expiresIn: tokens.expiresIn,
        },
      });
    },
  );

  // ── POST /mfa/setup ───────────────────────────────────────────────────────
  fastify.post(
    "/mfa/setup",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Multi-Factor Authentication"],
        summary: "Initialize MFA setup and generate QR code",
        security: [{ bearerAuth: [] }],
        body: z.object({ type: z.literal("TOTP") }),
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.object({
              secret: z.string(),
              uri: z.string(),
              qrCode: z.string(),
            }),
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(mfaSetupFlow, req.body, {
        identityId: req.identity.id,
        tenantId: req.identity.tenantId,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return reply.send({ success: true, data: result });
    },
  );

  // ── POST /mfa/confirm ─────────────────────────────────────────────────────
  fastify.post(
    "/mfa/confirm",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Multi-Factor Authentication"],
        summary: "Confirm MFA setup with first TOTP code",
        security: [{ bearerAuth: [] }],
        body: z.object({ code: z.string().length(6) }),
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.object({ recoveryCodes: z.array(z.string()) }),
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(mfaConfirmFlow, req.body, {
        identityId: req.identity.id,
        tenantId: req.identity.tenantId,
        ip: req.ip,
      });
      return reply.send({ success: true, data: result });
    },
  );

  // ── DELETE /mfa/disable ───────────────────────────────────────────────────
  // FIX (Bug 4): Was registered as fastify.post() — HTTP method mismatch.
  // The API client calls DELETE /auth/mfa/disable (apiClient.delete(...)).
  // A POST registration means the route was completely unreachable via the client.
  fastify.delete(
    "/mfa/disable",
    {
      preHandler: fastify.auth.requireElevated,
      schema: {
        tags: ["Multi-Factor Authentication"],
        summary:
          "Disable MFA for the current identity — requires step-up re-authentication",
        security: [{ bearerAuth: [] }],
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      await disableMfa(req.identity.id, fastify.db, req.ip);
      return reply.send({ success: true });
    },
  );
}
