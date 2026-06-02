// src/modules/oauth/routes/consent.route.ts
import type { FastifyInstance } from "fastify";
import { ConsentService } from "../services/consent.service";
import { z } from "zod";

export async function consentRoute(fastify: FastifyInstance) {
  // Grant consent
  fastify.post(
    "/consent",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "Grant user consent for an OAuth2 client",
        security: [{ bearerAuth: [] }],
        body: z.object({
          clientId: z.string().min(1),
          scopes: z.array(z.string()).min(1),
        }),
        response: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    async (req, reply) => {
      const { clientId, scopes } = req.body as {
        clientId: string;
        scopes: string[];
      };
      const consentService = new ConsentService(fastify.db);
      await consentService.grant(req.identity.id, clientId, scopes);
      return reply.send({ success: true });
    },
  );

  // Revoke consent
  fastify.delete(
    "/consent",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "Revoke user consent for an OAuth2 client",
        security: [{ bearerAuth: [] }],
        body: z.object({
          clientId: z.string().min(1),
        }),
        response: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    async (req, reply) => {
      const { clientId } = req.body as { clientId: string };
      const consentService = new ConsentService(fastify.db);
      await consentService.revoke(req.identity.id, clientId);
      return reply.send({ success: true });
    },
  );

  // List consents
  fastify.get(
    "/consents",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "List active OAuth2 consents for current identity",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(z.any()),
          }),
        },
      },
    },
    async (req, reply) => {
      const consents = await fastify.db.oAuthConsent.findMany({
        where: { identityId: req.identity.id, revokedAt: null },
        include: {
          client: { select: { name: true, clientId: true, logoUri: true } },
        },
      });
      return reply.send({ success: true, data: consents });
    },
  );
}
