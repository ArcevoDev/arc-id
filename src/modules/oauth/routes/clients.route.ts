// src/modules/oauth/routes/clients.route.ts
// FIX: was gated behind requireScope("admin:write") — no standard token ever has this
// scope, making client management completely inaccessible.
// Now checks ADMIN role in the target tenant instead.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashPassword } from "@/modules/auth/services/password.service";
import { generateToken } from "@/lib/crypto";
import { ApiError } from "@/core/errors";

const CreateClientSchema = z.object({
  name: z.string().min(1),
  grantTypes: z
    .array(z.enum(["authorization_code", "refresh_token", "client_credentials"]))
    .default(["authorization_code", "refresh_token"]),
  scopes: z.array(z.string()).default(["openid", "profile", "email"]),
  redirectUris: z.array(z.string().url()).default([]),
  public: z.boolean().default(false),
  requirePkce: z.boolean().default(true),
  tenantId: z.string().cuid().optional(),
  logoUri: z.string().url().optional(),
  tosUri: z.string().url().optional(),
  policyUri: z.string().url().optional(),
});

async function assertTenantAdmin(
  fastify: FastifyInstance,
  identityId: string,
  tenantId: string,
) {
  const membership = await fastify.db.tenantMembership.findFirst({
    where: { identityId, tenantId, status: "ACTIVE" },
    include: { role: { select: { name: true } } },
  });
  if (!membership) throw ApiError.forbidden("You are not a member of this tenant");
  if (membership.role.name !== "ADMIN") {
    throw ApiError.forbidden("Only tenant ADMINs can manage OAuth clients");
  }
}

export async function clientsRoute(fastify: FastifyInstance) {

  // POST /oauth/clients
  fastify.post(
    "/clients",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "Register an OAuth application client — requires ADMIN role in the target tenant",
        security: [{ bearerAuth: [] }],
        body: CreateClientSchema,
        response: {
          201: z.object({
            success: z.boolean(),
            data: z.object({
              clientId: z.string(),
              clientSecret: z.string().nullable(),
              name: z.string(),
              grantTypes: z.array(z.string()),
              scopes: z.array(z.string()),
              redirectUris: z.array(z.string()),
              public: z.boolean(),
              requirePkce: z.boolean(),
            }),
          }),
        },
      },
    },
    async (req, reply) => {
      const input = CreateClientSchema.parse(req.body);
      const targetTenantId = input.tenantId ?? req.identity.tenantId ?? "SYSTEM";

      await assertTenantAdmin(fastify, req.identity.id, targetTenantId);

      const clientId = generateToken(16);
      const clientSecret = input.public ? null : generateToken(32);
      const secretHash = clientSecret ? await hashPassword(clientSecret) : null;

      const client = await fastify.db.client.create({
        data: {
          name: input.name,
          clientId,
          clientSecret: secretHash,
          grantTypes: input.grantTypes,
          scopes: input.scopes,
          public: input.public,
          requirePkce: input.requirePkce,
          tenantId: targetTenantId,
          logoUri: input.logoUri,
          tosUri: input.tosUri,
          policyUri: input.policyUri,
          redirectUris: { create: input.redirectUris.map((uri) => ({ uri })) },
        },
        include: { redirectUris: true },
      });

      await fastify.db.auditLog.create({
        data: {
          actionId: "SIGNING_KEY_CREATED",
          tenantId: targetTenantId,
          identityId: req.identity.id,
          ip: req.ip,
          metadata: { clientId, name: input.name },
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          clientId,
          clientSecret: clientSecret ?? null, // returned once — not stored
          name: client.name,
          grantTypes: client.grantTypes as string[],
          scopes: client.scopes as string[],
          redirectUris: client.redirectUris.map((r) => r.uri),
          public: client.public,
          requirePkce: client.requirePkce,
        },
      });
    },
  );

  // GET /oauth/clients
  fastify.get(
    "/clients",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "List OAuth clients for your active tenant",
        security: [{ bearerAuth: [] }],
        querystring: z.object({ tenantId: z.string().cuid().optional() }),
        response: { 200: z.object({ success: z.boolean(), data: z.array(z.any()) }) },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.query as { tenantId?: string };
      const targetTenantId = tenantId ?? req.identity.tenantId ?? "SYSTEM";

      await assertTenantAdmin(fastify, req.identity.id, targetTenantId);

      const clients = await fastify.db.client.findMany({
        where: { tenantId: targetTenantId },
        select: {
          id: true, name: true, clientId: true, public: true,
          grantTypes: true, scopes: true, tenantId: true, createdAt: true,
          requirePkce: true, redirectUris: { select: { uri: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ success: true, data: clients });
    },
  );

  // DELETE /oauth/clients/:clientId
  fastify.delete(
    "/clients/:clientId",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "Delete an OAuth client",
        security: [{ bearerAuth: [] }],
        params: z.object({ clientId: z.string().min(1) }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const { clientId } = req.params as { clientId: string };
      const client = await fastify.db.client.findFirst({ where: { clientId } });
      if (!client) throw ApiError.notFound("Client not found");

      await assertTenantAdmin(fastify, req.identity.id, client.tenantId ?? "SYSTEM");
      await fastify.db.client.delete({ where: { id: client.id } });

      return reply.send({ success: true });
    },
  );
}