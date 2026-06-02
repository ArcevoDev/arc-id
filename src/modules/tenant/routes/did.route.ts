// src/modules/tenant/routes/did.route.ts
import type { FastifyInstance } from "fastify";
import { generateKeyPair, exportSPKI } from "jose";
import { randomUUID } from "crypto";
import { z } from "zod";
import { TenantService } from "../services/tenant.service";

export async function tenantDidRoute(fastify: FastifyInstance) {
  fastify.post(
    "/:tenantId/did",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "Provision a did:web DID for this tenant",
        security: [{ bearerAuth: [] }],
        params: z.object({ tenantId: z.string().uuid() }),
        body: z.object({
          domain: z.string().min(1), // e.g. "health.arcevo.io"
        }),
        response: {
          201: z.object({
            success: z.boolean(),
            data: z.object({ did: z.string(), document: z.any() }),
          }),
          409: z.object({
            success: z.boolean(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.params as { tenantId: string };
      const { domain } = req.body as { domain: string };

      const tenantService = new TenantService(fastify.db);
      await tenantService.assertMembership(tenantId, req.identity.id, "ADMIN");

      // Check if DID already exists
      const existing = await fastify.db.decentralizedIdentifier.findUnique({
        where: { tenantId },
      });
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: "CONFLICT",
          message: "Tenant already has a DID provisioned",
        } as any);
      }

      // Generate EC keypair
      const { publicKey } = await generateKeyPair("ES256");
      const publicKeySpki = await exportSPKI(publicKey);
      const cleanBase64 = publicKeySpki
        .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----/g, "")
        .replace(/[\r\n\s]/g, "");
      const publicKeyBytes = Buffer.from(cleanBase64, "base64");

      const did = `did:web:${domain}`;
      const didDocument = {
        "@context": ["[w3.org](https://www.w3.org/ns/did/v1)"],
        id: did,
        verificationMethod: [
          {
            id: `${did}#key-1`,
            type: "JsonWebKey2020",
            controller: did,
            publicKeyMultibase: `z${cleanBase64}`,
          },
        ],
        authentication: [`${did}#key-1`],
        assertionMethod: [`${did}#key-1`],
      };

      const record = await fastify.db.decentralizedIdentifier.create({
        data: {
          id: did,
          tenantId,
          publicKeyBytes,
          keyType: "JsonWebKey2020",
          didDocument,
        },
      });

      return reply.status(201).send({
        success: true,
        data: { did: record.id, document: record.didDocument },
      });
    },
  );

  fastify.get(
    "/:tenantId/did",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "Fetch tenant DID document",
        security: [{ bearerAuth: [] }],
        params: z.object({ tenantId: z.string().uuid() }),
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.params as { tenantId: string };
      const did = await fastify.db.decentralizedIdentifier.findUnique({
        where: { tenantId },
      });
      if (!did) return reply.status(404).send({ error: "NOT_FOUND" } as any);
      return reply.send({
        success: true,
        data: { did: did.id, document: did.didDocument },
      });
    },
  );
}
