import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { commonErrorSchema } from "@/core/errors/error-schemas";
import type { PrismaClient } from "@/prisma-client";

export async function consentRoute(fastify: FastifyInstance) {
  // Cast fastify.db to ensure explicit type mapping inside the route module scope
  const db = fastify.db as PrismaClient;

  // POST /oauth/consent
  fastify.post(
    "/consent",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth 2.0 / OIDC Protocol"],
        summary: "Grant scopes for an OAuth client on behalf of the current user",
        security: [{ bearerAuth: [] }],
        body: z.object({
          clientId: z.string().min(1),
          scopes: z.array(z.string()).min(1),
        }),
        response: {
          200: z.object({ success: z.boolean() }),
          404: commonErrorSchema,
        },
      },
    },
    async (req, reply) => {
      const { clientId, scopes } = req.body as { clientId: string; scopes: string[] };

      const client = await db.client.findFirst({
        where: { clientId },
        select: { id: true, scopes: true },
      });

      if (!client) {
        return reply.status(404).send({ success: false, error: "CLIENT_NOT_FOUND" });
      }

      // Cast JsonValue to string array for includes()
      const clientScopes = (client.scopes as string[]) || [];
      const allowed = scopes.filter((s) => clientScopes.includes(s));

      // Explicitly types and calls the upsert layout payload
      await db.oAuthConsent.upsert({
        where: {
          identityId_clientId: {
            identityId: req.identity.id,
            clientId: client.id,
          },
        },
        update: { 
          scopes: allowed,
          updatedAt: new Date(),
        },
        create: {
          identityId: req.identity.id,
          clientId: client.id,
          scopes: allowed,
        },
      });

      await db.auditLog.create({
        data: {
          actionId: "OAUTH_CONSENT_GRANTED",
          identityId: req.identity.id,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          metadata: { clientId, scopes: allowed },
        },
      });

      return reply.send({ success: true });
    },
  );

  // DELETE /oauth/consent/:clientId
  fastify.delete(
    "/consent/:clientId",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth 2.0 / OIDC Protocol"],
        summary: "Revoke previously granted consent",
        security: [{ bearerAuth: [] }],
        params: z.object({ clientId: z.string().min(1) }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const { clientId } = req.params as { clientId: string };
      const client = await db.client.findFirst({ where: { clientId }, select: { id: true } });
      if (client) {
        await db.oAuthConsent.deleteMany({
          where: { identityId: req.identity.id, clientId: client.id },
        });
      }
      return reply.send({ success: true });
    },
  );

  // GET /oauth/consents
  fastify.get(
    "/consents",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth 2.0 / OIDC Protocol"],
        summary: "List all granted OAuth consents",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ success: z.boolean(), data: z.array(z.any()) }),
        },
      },
    },
    async (req, reply) => {
      const consents = await db.oAuthConsent.findMany({
        where: { identityId: req.identity.id },
        include: { client: { select: { clientId: true, name: true } } },
      });

      return reply.send({
        success: true,
        data: consents.map((c) => ({
          clientId: c.client.clientId,
          clientName: c.client.name,
          scopes: c.scopes,
          grantedAt: c.grantedAt,
        })),
      });
    },
  );
}