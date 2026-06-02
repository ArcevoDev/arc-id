import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { passkeyRegisterFlow } from "../flows/passkey-register.flow";
import { passkeyAuthenticateFlow } from "../flows/passkey-authenticate.flow";
import { PasskeyService } from "../services/passkey.service";
import { z } from "zod";

export async function passkeyRoute(fastify: FastifyInstance) {
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

      // Store challenge server-side (use session or Redis)
      // For now store in the session metadata — production should use Redis
      await fastify.db.session.updateMany({
        where: { identityId: req.identity.id, valid: true },
        data: { riskSignals: { challenge: options.challenge } as any },
      });

      return reply.send({ success: true, data: options });
    },
  );

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
      const options =
        await passkeyService.generateAuthenticationOptions(identityId);
      return reply.send({ success: true, data: options });
    },
  );
}
