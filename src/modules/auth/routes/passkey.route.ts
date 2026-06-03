// src/modules/auth/routes/passkey.route.ts
import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { passkeyRegisterFlow } from "../flows/passkey-register.flow";
import { passkeyAuthenticateFlow } from "../flows/passkey-authenticate.flow";
import { PasskeyService } from "../services/passkey.service";
import { z } from "zod";

export async function passkeyRoute(fastify: FastifyInstance) {
  // 1. Generate Registration Options
  fastify.post(
    "/passkey/options/register",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Passkeys / WebAuthn"],
        summary: "Generate registration options for a new passkey",
        security: [{ bearerAuth: [] }],
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const identity = await fastify.db.identity.findUniqueOrThrow({
        where: { id: req.identity.id },
        select: { primaryEmail: true },
      });

      const passkeyService = new PasskeyService(fastify.db);
      const options = await passkeyService.generateRegistrationOptions(
        req.identity.id,
        identity.primaryEmail ?? req.identity.id,
      );

      // Persist challenge server-side in the current active session meta
      const currentSession = await fastify.db.session.findFirst({
        where: { identityId: req.identity.id, valid: true },
        orderBy: { createdAt: "desc" },
      });

      if (currentSession) {
        await fastify.db.session.update({
          where: { id: currentSession.id },
          data: { riskSignals: { challenge: options.challenge } as any },
        });
      }

      return reply.send({ success: true, data: options });
    },
  );

  // 2. Execute WebAuthn Registration Flow
  fastify.post(
    "/passkey/register",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Passkeys / WebAuthn"],
        summary: "Verify and save registered credential public key",
        security: [{ bearerAuth: [] }],
        body: z.object({
          response: z.record(z.string(), z.unknown()),
          challenge: z.string(),
        }),
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(passkeyRegisterFlow, req.body, {
        userId: req.identity.id,
        tenantId: req.identity.tenantId,
        ip: req.ip,
      });
      return reply.send({ success: true, data: result });
    },
  );

  // 3. Generate Authentication Options
  fastify.post(
    "/passkey/options/authenticate",
    {
      schema: {
        tags: ["Passkeys / WebAuthn"],
        summary: "Generate authentication options for passkey login",
        body: z.object({ identityId: z.string().cuid().optional() }),
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const { identityId } = req.body as { identityId?: string };
      const passkeyService = new PasskeyService(fastify.db);
      const options = await passkeyService.generateAuthenticationOptions(identityId);
      return reply.send({ success: true, data: options });
    },
  );

  // 4. Execute WebAuthn Assertion Authentication Flow
  fastify.post(
    "/passkey/authenticate",
    {
      schema: {
        tags: ["Passkeys / WebAuthn"],
        summary: "Authenticate via passkey assertion payload signature",
        body: z.object({
          response: z.record(z.string(), z.unknown()),
          challenge: z.string(),
        }),
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(passkeyAuthenticateFlow, req.body, {
        tenantId: null,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return reply.send({ success: true, data: result });
    },
  );
}