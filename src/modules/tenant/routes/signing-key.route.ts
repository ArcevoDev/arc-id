// src/modules/tenant/routes/signing-key.route.ts
// NOTE: Mounted under /tenants prefix — full paths are /tenants/:tenantId/signing-keys
import type { FastifyInstance } from "fastify";
import { generateKeyPair, exportSPKI, exportPKCS8 } from "jose";
import { randomUUID } from "crypto";
import { z } from "zod";
import { ApiError } from "@/core/errors";
import { TenantService } from "../services/tenant.service";

export async function signingKeyRoute(fastify: FastifyInstance) {
  // ── POST /:tenantId/signing-keys ─────────────────────────────────────────
  fastify.post(
    "/:tenantId/signing-keys",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Cryptographic Key Authority"],
        summary:
          "Generate an asymmetric EC keypair bound to this tenant for VC/token signing",
        security: [{ bearerAuth: [] }],
        // FIXED: was z.string().uuid() — tenants use cuid(), not uuid
        params: z.object({ tenantId: z.string().cuid() }),
        response: {
          201: z.object({
            success: z.boolean(),
            data: z.object({
              kid: z.string(),
              algorithm: z.string(),
              publicKey: z.string(),
              status: z.string(),
              createdAt: z.coerce.string(),
            }),
          }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.params as { tenantId: string };

      const tenantService = new TenantService(fastify.db);
      await tenantService.assertMembership(tenantId, req.identity.id, "ADMIN");

      const algorithm = "ES256";
      const { publicKey, privateKey } = await generateKeyPair(algorithm);

      const publicKeySpki = await exportSPKI(publicKey);
      const privateKeyPkcs8 = await exportPKCS8(privateKey);
      const kid = randomUUID();

      const cleanPublicBase64 = publicKeySpki
        .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----/g, "")
        .replace(/[\r\n\s]/g, "");

      const cleanPrivateBase64 = privateKeyPkcs8
        .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----/g, "")
        .replace(/[\r\n\s]/g, "");

      const signingKey = await fastify.db.tenantSigningKey.create({
        data: {
          tenantId,
          kid,
          algorithm,
          publicKey: Buffer.from(cleanPublicBase64, "base64"),
          privateKey: Buffer.from(cleanPrivateBase64, "base64"),
          status: "ACTIVE",
        },
      });

      await fastify.db.auditLog.create({
        data: {
          actionId: "SIGNING_KEY_CREATED",
          tenantId,
          identityId: req.identity.id,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          metadata: { kid, algorithm },
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          kid: signingKey.kid,
          algorithm: signingKey.algorithm,
          publicKey: publicKeySpki,
          status: signingKey.status,
          createdAt: signingKey.createdAt.toISOString(),
        },
      });
    },
  );

  // ── GET /:tenantId/signing-keys ──────────────────────────────────────────
  fastify.get(
    "/:tenantId/signing-keys",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Cryptographic Key Authority"],
        summary: "List active signing key metadata for this tenant",
        security: [{ bearerAuth: [] }],
        params: z.object({ tenantId: z.string().cuid() }),
        response: {
          200: z.object({ success: z.boolean(), data: z.array(z.any()) }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.params as { tenantId: string };

      const tenantService = new TenantService(fastify.db);
      await tenantService.assertMembership(tenantId, req.identity.id);

      const keys = await fastify.db.tenantSigningKey.findMany({
        where: { tenantId, status: "ACTIVE" },
        select: {
          kid: true,
          algorithm: true,
          status: true,
          createdAt: true,
          expiresAt: true,
          kmsProvider: true,
        },
      });

      return reply.send({ success: true, data: keys });
    },
  );

  // ── DELETE /:tenantId/signing-keys/:kid ───────────────────────────────────
  fastify.delete(
    "/:tenantId/signing-keys/:kid",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Cryptographic Key Authority"],
        summary: "Revoke a tenant signing key by KID",
        security: [{ bearerAuth: [] }],
        params: z.object({
          tenantId: z.string().cuid(),
          kid: z.string().min(1),
        }),
        response: {
          200: z.object({ success: z.boolean(), message: z.string() }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId, kid } = req.params as { tenantId: string; kid: string };

      const tenantService = new TenantService(fastify.db);
      await tenantService.assertMembership(tenantId, req.identity.id, "ADMIN");

      const updateResult = await fastify.db.tenantSigningKey.updateMany({
        where: { tenantId, kid, status: "ACTIVE" },
        data: { status: "REVOKED" },
      });

      if (updateResult.count === 0) {
        throw ApiError.notFound(
          "Active signing key not found or already revoked",
        );
      }

      await fastify.db.auditLog.create({
        data: {
          actionId: "SIGNING_KEY_REVOKED",
          tenantId,
          identityId: req.identity.id,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          metadata: { kid },
        },
      });

      return reply.send({ success: true, message: "Signing key revoked" });
    },
  );
}
