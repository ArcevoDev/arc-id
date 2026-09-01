// src/modules/api-key/routes/api-key.route.ts
import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows";
import { createApiKeyFlow } from "../flows/create-api-key.flow";
import { revokeApiKeyFlow } from "../flows/revoke-api-key.flow";
import { listApiKeysFlow } from "../flows/list-api-keys.flow";
import { CreateApiKeySchema, RevokeApiKeySchema } from "../validators/api-key.schemas";
import { z } from "zod";

const ApiKeyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  scopes: z.array(z.string()),
  status: z.string(),
  lastUsedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const CreateApiKeyResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    key: z.string(), // plaintext — shown ONCE
    name: z.string(),
    keyPrefix: z.string(),
    scopes: z.array(z.string()),
    createdAt: z.coerce.date(),
  }),
});

export async function apiKeyRoute(fastify: FastifyInstance) {
  // POST /api-keys/create — generate a new API key
  fastify.post(
    "/api-keys/create",
    {
      preHandler: [
        fastify.auth.requireUser,
        fastify.auth.requirePermission("api-key:create"),
      ],
      config: {
        rateLimit: { max: 10, timeWindow: "15 minutes" },
      },
      schema: {
        tags: ["API Key Management"],
        summary: "Create a new API key",
        description:
          "Issues a new machine-to-machine API key. The plaintext key is returned " +
          "only once — it is never stored or retrievable after this response.",
        security: [{ bearerAuth: [] }],
        body: CreateApiKeySchema,
        response: {
          201: CreateApiKeyResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(createApiKeyFlow, req.body, {
        identityId: req.identity.id,
        tenantId: req.identity.tenantId ?? "SYSTEM",
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return reply.status(201).send({ success: true, data: result });
    },
  );

  // GET /api-keys — list the caller's active API keys
  fastify.get(
    "/api-keys",
    {
      preHandler: [
        fastify.auth.requireUser,
        fastify.auth.requirePermission("api-key:read"),
      ],
      schema: {
        tags: ["API Key Management"],
        summary: "List API keys",
        description: "Returns metadata for all active API keys belonging to the caller.",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(ApiKeyResponseSchema),
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(listApiKeysFlow, {}, {
        identityId: req.identity.id,
        tenantId: req.identity.tenantId ?? "SYSTEM",
        ip: req.ip,
      });
      return reply.send({ success: true, data: result });
    },
  );

  // DELETE /api-keys/:id — revoke an API key
  fastify.delete(
    "/api-keys/:id",
    {
      preHandler: [
        fastify.auth.requireUser,
        fastify.auth.requirePermission("api-key:revoke"),
      ],
      config: {
        rateLimit: { max: 30, timeWindow: "15 minutes" },
      },
      schema: {
        tags: ["API Key Management"],
        summary: "Revoke an API key",
        description:
          "Marks an API key as REVOKED. Revoked keys cannot authenticate requests.",
        security: [{ bearerAuth: [] }],
        params: RevokeApiKeySchema,
        response: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    async (req, reply) => {
      await flowExecutor.run(revokeApiKeyFlow, req.params, {
        identityId: req.identity.id,
        tenantId: req.identity.tenantId ?? "SYSTEM",
      });
      return reply.send({ success: true });
    },
  );
}
