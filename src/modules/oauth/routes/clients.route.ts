import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashPassword } from "@/modules/auth/services/password.service";
import { generateToken } from "@/lib/crypto";

const CreateClientSchema = z.object({
  name: z.string().min(1),
  grantTypes: z
    .array(
      z.enum(["authorization_code", "refresh_token", "client_credentials"]),
    )
    .default(["authorization_code", "refresh_token"]),
  scopes: z.array(z.string()).default(["openid", "profile", "email"]),
  redirectUris: z.array(z.string().url()).default([]),
  public: z.boolean().default(false),
  requirePkce: z.boolean().default(true),
  tenantId: z.string().optional(),
  logoUri: z.string().url().optional(),
  tosUri: z.string().url().optional(),
  policyUri: z.string().url().optional(),
});

export async function clientsRoute(fastify: FastifyInstance) {
  fastify.post(
    "/clients",
    {
      preHandler: fastify.auth.requireScope("admin:write"),
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "Register a brand new application client descriptor",
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
          tenantId: input.tenantId ?? null,
          logoUri: input.logoUri,
          tosUri: input.tosUri,
          policyUri: input.policyUri,
          redirectUris: {
            create: input.redirectUris.map((uri) => ({ uri })),
          },
        },
        include: { redirectUris: true },
      });

      return reply.status(201).send({
        success: true,
        data: {
          clientId,
          clientSecret: clientSecret ?? null,
          name: client.name,
          grantTypes: client.grantTypes,
          scopes: client.scopes,
          redirectUris: client.redirectUris.map((r) => r.uri),
          public: client.public,
          requirePkce: client.requirePkce,
        },
      });
    },
  );

  fastify.get(
    "/clients",
    {
      preHandler: fastify.auth.requireScope("admin:read"),
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "List application clients",
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          tenantId: z.string().optional(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(z.any()),
          }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.query as { tenantId?: string };
      const clients = await fastify.db.client.findMany({
        where: tenantId ? { tenantId } : {},
        select: {
          id: true,
          name: true,
          clientId: true,
          public: true,
          grantTypes: true,
          scopes: true,
          tenantId: true,
          createdAt: true,
          requirePkce: true,
          redirectUris: { select: { uri: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return reply.send({ success: true, data: clients });
    },
  );

  fastify.delete(
    "/clients/:clientId",
    {
      preHandler: fastify.auth.requireScope("admin:write"),
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "Purge a client application identity handle",
        security: [{ bearerAuth: [] }],
        params: z.object({
          clientId: z.string().min(1),
        }),
        response: {
          200: z.object({ success: z.boolean() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      const { clientId } = req.params as { clientId: string };
      const client = await fastify.db.client.findFirst({ where: { clientId } });
      if (!client) return reply.status(404).send({ error: "NOT_FOUND" });

      await fastify.db.client.delete({ where: { id: client.id } });
      return reply.send({ success: true });
    },
  );
}
