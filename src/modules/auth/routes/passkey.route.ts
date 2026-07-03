// src/modules/auth/routes/passkey.route.ts
import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows";
import { passkeyRegisterFlow } from "../flows/passkey-register.flow";
import { passkeyAuthenticateFlow } from "../flows/passkey-authenticate.flow";
import { PasskeyService } from "../services/passkey.service";
import { storeChallenge } from "@/lib/challenge-store";
import { auditService } from "@/modules/audit/services/audit.service";
import { ApiError } from "@/core/errors";
import { z } from "zod";

export async function passkeyRoute(fastify: FastifyInstance) {
  // ── 1. Generate Registration Options ──────────────────────────────────────
  fastify.post(
    "/passkey/options/register",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Passkeys / WebAuthn"],
        summary: "Generate registration options for a new passkey",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.object({ options: z.any(), challengeId: z.string() }),
          }),
        },
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

      const { challengeId } = await storeChallenge(
        req.identity.id,
        "registration",
        options.challenge,
      );

      return reply.send({ success: true, data: { options, challengeId } });
    },
  );

  // ── 2. Verify Registration ─────────────────────────────────────────────────
  fastify.post(
    "/passkey/register",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Passkeys / WebAuthn"],
        summary: "Verify and persist the registered passkey credential",
        security: [{ bearerAuth: [] }],
        body: z.object({
          response: z.record(z.string(), z.unknown()),
          challengeId: z.string().uuid(),
        }),
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(passkeyRegisterFlow, req.body, {
        identityId: req.identity.id,
        tenantId: req.identity.tenantId,
        ip: req.ip,
      });
      return reply.send({ success: true, data: result });
    },
  );

  // ── 3. Generate Authentication Options ────────────────────────────────────
  fastify.post(
    "/passkey/options/authenticate",
    {
      schema: {
        tags: ["Passkeys / WebAuthn"],
        summary: "Generate authentication options for passkey sign-in",
        body: z.object({ identityId: z.string().optional() }),
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.object({ options: z.any(), challengeId: z.string() }),
          }),
        },
      },
    },
    async (req, reply) => {
      const { identityId } = req.body as { identityId?: string };
      const passkeyService = new PasskeyService(fastify.db);
      const options =
        await passkeyService.generateAuthenticationOptions(identityId);

      const { challengeId } = await storeChallenge(
        identityId ?? "anonymous",
        "authentication",
        options.challenge,
      );

      return reply.send({ success: true, data: { options, challengeId } });
    },
  );

  // ── 4. Verify Authentication ───────────────────────────────────────────────
  fastify.post(
    "/passkey/authenticate",
    {
      schema: {
        tags: ["Passkeys / WebAuthn"],
        summary: "Authenticate via passkey assertion",
        body: z.object({
          response: z.record(z.string(), z.unknown()),
          challengeId: z.string().uuid(),
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

  // ── 5. List registered passkeys ────────────────────────────────────────────
  // Returns metadata only — public keys and counters are never exposed.
  fastify.get(
    "/passkey",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Passkeys / WebAuthn"],
        summary: "List passkeys registered to the current identity",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(
              z.object({
                id: z.string(),
                credentialId: z.string(),
                deviceType: z.string(),
                backedUp: z.boolean(),
                transports: z.any(),
                createdAt: z.coerce.string(),
                lastUsedAt: z.coerce.string(),
              }),
            ),
          }),
        },
      },
    },
    async (req, reply) => {
      const passkeys = await fastify.db.passkey.findMany({
        where: { identityId: req.identity.id },
        select: {
          id: true,
          credentialId: true,
          deviceType: true,
          backedUp: true,
          transports: true,
          createdAt: true,
          lastUsedAt: true,
          // publicKey and counter are never returned — security boundary
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ success: true, data: passkeys });
    },
  );

  // ── 6. Delete (deregister) a passkey ──────────────────────────────────────
  // Requires step-up elevation: deregistering a passkey is a privileged operation
  // because it reduces the security posture of the account.
  fastify.delete(
    "/passkey/:passkeyId",
    {
      preHandler: fastify.auth.requireElevated,
      schema: {
        tags: ["Passkeys / WebAuthn"],
        summary:
          "Deregister a passkey — requires recent step-up re-authentication",
        security: [{ bearerAuth: [] }],
        params: z.object({ passkeyId: z.string().cuid() }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const { passkeyId } = req.params as { passkeyId: string };

      // Confirm the passkey belongs to the authenticated identity before deleting.
      const passkey = await fastify.db.passkey.findFirst({
        where: { id: passkeyId, identityId: req.identity.id },
        select: { id: true, credentialId: true },
      });

      if (!passkey) {
        throw ApiError.notFound(
          "Passkey not found or does not belong to your account",
        );
      }

      // Guard: prevent removing the last passkey if no other auth method exists.
      // This avoids locking the user out of their account.
      const passkeyCount = await fastify.db.passkey.count({
        where: { identityId: req.identity.id },
      });

      const hasLocalAccount = await fastify.db.localAccount.count({
        where: { identityId: req.identity.id },
      });

      if (passkeyCount === 1 && hasLocalAccount === 0) {
        throw ApiError.badRequest(
          "Cannot remove your only passkey when you have no password set — " +
            "set a password first or register another passkey",
        );
      }

      await fastify.db.passkey.delete({ where: { id: passkey.id } });

      void auditService
        .log({
          action: "PASSKEY_REGISTERED", // nearest existing action; PASSKEY_REMOVED in future migration
          identityId: req.identity.id,
          ip: req.ip,
          metadata: { deleted: true, credentialId: passkey.credentialId },
        })
        .catch(() => {});

      return reply.send({ success: true });
    },
  );
}
