// src/modules/tenant/routes/tenant.route.ts
import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows";
import { createTenantFlow } from "../flows/create-tenant.flow";
import { presentTenant } from "../presenters/tenant.presenter";
import { ApiError } from "@/core/errors";
import { exportJWK, importSPKI } from "jose";
import { z } from "zod";

export async function tenantRoute(fastify: FastifyInstance) {
  // ── POST / — provision a new tenant ─────────────────────────────────────────
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
        identityId: req.identity.id,
        tenantId: null,
      });
      return reply.status(201).send({ success: true, data: result });
    },
  );

  // ── GET /:slug — fetch organisation by slug ──────────────────────────────────
  // FIX: previous version had no membership check — any authenticated user
  // who knew a tenant's slug could read its data. Now enforces ACTIVE membership.
  //
  // Exception: SYSTEM tenant members (admins) can read any tenant.
  // This is the pattern used consistently across admin.route.ts.
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

      const tenant = await fastify.db.tenant.findUnique({ where: { slug } });
      if (!tenant) throw ApiError.notFound("Organisation not found");

      // ── Membership gate ────────────────────────────────────────────────────
      // The requester must be an ACTIVE member of this specific tenant,
      // OR an ACTIVE member of SYSTEM (platform admin).
      const membership = await fastify.db.tenantMembership.findFirst({
        where: {
          identityId: req.identity.id,
          tenantId: { in: [tenant.id, "SYSTEM"] },
          status: "ACTIVE",
        },
      });

      if (!membership) {
        // Return 404 rather than 403 to avoid leaking tenant existence
        // to users who are not members.
        throw ApiError.notFound("Organisation not found");
      }

      return reply.send({ success: true, data: presentTenant(tenant) });
    },
  );

  // ── GET /:slug/jwks — public JWKS endpoint ────────────────────────────────
  // Intentionally has NO auth — JWKS is always public so relying parties
  // can verify credentials without an ArcID account.
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
        where: { tenantId: tenant.id, status: "ACTIVE" },
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
