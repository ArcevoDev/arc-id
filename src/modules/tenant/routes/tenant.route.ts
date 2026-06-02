import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { createTenantFlow } from "../flows/create-tenant.flow";
import { presentTenant } from "../presenters/tenant.presenter";
import { exportJWK, importSPKI } from "jose";
import { z } from "zod";

export async function tenantRoute(fastify: FastifyInstance) {
  fastify.post(
    "/",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "Provision a new organisation",
        security: [{ bearerAuth: [] }],
        body: z.object({ name: z.string().min(1), slug: z.string().min(1) }),
        response: { 201: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(createTenantFlow, req.body, {
        userId: req.identity.id,
        tenantId: null,
      });
      return reply.status(201).send({ success: true, data: result });
    },
  );

  fastify.get(
    "/:slug",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "Fetch organisation by slug",
        security: [{ bearerAuth: [] }],
        params: z.object({ slug: z.string().min(1) }),
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const tenant = await fastify.db.tenant.findUniqueOrThrow({
        where: { slug },
      });
      return reply.send({ success: true, data: presentTenant(tenant) });
    },
  );

  fastify.get(
    "/:slug/jwks",
    {
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "Resolve tenant public signing keys (JWKS)",
        params: z.object({ slug: z.string().min(1) }),
        response: {
          200: z.object({ keys: z.array(z.record(z.string(), z.any())) }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const tenant = await fastify.db.tenant.findUnique({ where: { slug } });
      if (!tenant) return reply.status(404).send({ error: "NOT_FOUND" });

      const keys = await fastify.db.tenantSigningKey.findMany({
        where: { tenantId: tenant.id, status: "ACTIVE" }, // ← was isActive: true
      });

      const jwks = await Promise.all(
        keys.map(async (key) => {
          try {
            const pem = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(key.publicKey).toString("base64")}\n-----END PUBLIC KEY-----`;
            const cryptoKey = await importSPKI(pem, key.algorithm);
            const jwk = await exportJWK(cryptoKey);
            return { ...jwk, kid: key.kid, alg: key.algorithm, use: "sig" };
          } catch {
            return null;
          }
        }),
      );

      return reply.send({ keys: jwks.filter(Boolean) });
    },
  );
}
