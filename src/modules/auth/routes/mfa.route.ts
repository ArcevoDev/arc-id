import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { mfaVerifyFlow } from "../flows/mfa-verify.flow";
import {
  mfaSetupFlow,
  mfaConfirmFlow,
  disableMfa,
} from "../flows/mfa-setup.flow";
import { z } from "zod";

export async function mfaRoute(fastify: FastifyInstance) {
  // ── POST /mfa/verify ──────────────────────────────────────────────────────
  fastify.post(
    "/mfa/verify",
    {
      config: { rateLimit: { max: 5, timeWindow: "5 minutes" } },
      schema: {
        tags: ["Multi-Factor Authentication"],
        summary: "Verify TOTP second factor code",
        body: z.object({
          code: z.string().length(6),
          sessionId: z.string().cuid(), // ← was mfaToken — now aligned with MfaVerifySchema
        }),
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(mfaVerifyFlow, req.body, {
        tenantId: null,
        ip: req.ip,
      });
      return reply.send({ success: true, data: result });
    },
  );

  // ── POST /mfa/setup ───────────────────────────────────────────────────────
  fastify.post(
    "/mfa/setup",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Multi-Factor Authentication"],
        summary: "Initialize TOTP MFA setup — returns QR code and secret",
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
        userId: req.identity.id,
        tenantId: req.identity.tenantId,
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
        summary: "Confirm TOTP setup — returns one-time recovery codes",
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
        userId: req.identity.id,
        tenantId: req.identity.tenantId,
      });
      return reply.send({ success: true, data: result });
    },
  );

  // ── DELETE /mfa ───────────────────────────────────────────────────────────
  fastify.delete(
    "/mfa",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Multi-Factor Authentication"],
        summary: "Disable MFA — sends security alert email",
        security: [{ bearerAuth: [] }],
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      await disableMfa(req.identity.id, fastify.db, req.ip);
      return reply.send({ success: true });
    },
  );
} // ← closing brace that was missing
