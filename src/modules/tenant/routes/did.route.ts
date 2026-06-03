// src/modules/tenant/routes/did.route.ts
// NOTE: Mounted under /tenants prefix — full paths are /tenants/:tenantId/did
import type { FastifyInstance } from "fastify";
import { generateKeyPair, exportSPKI } from "jose";
import { z } from "zod";
import { TenantService } from "../services/tenant.service";

export async function tenantDidRoute(fastify: FastifyInstance) {
  // POST /tenants/:tenantId/did
  fastify.post(
    "/:tenantId/did",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "Provision a did:web Decentralized Identifier for this tenant",
        security: [{ bearerAuth: [] }],
        // FIXED: was z.string().uuid() — tenants use cuid()
        params: z.object({ tenantId: z.string().cuid() }),
        body: z.object({
          domain: z.string().min(1).describe("e.g. health.arcevocirqle.com.ng"),
        }),
        // FIXED: removed conflicting 409 response schema (causes Fastify schema conflict)
        // Errors are handled via the global error handler
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

      const existing = await fastify.db.decentralizedIdentifier.findUnique({
        where: { tenantId },
      });
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: "CONFLICT",
          message: "Tenant already has a DID provisioned",
        });
      }

      // Generate EC keypair for this tenant's DID
      const { publicKey } = await generateKeyPair("ES256");
      const publicKeySpki = await exportSPKI(publicKey);
      const cleanBase64 = publicKeySpki
        .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----/g, "")
        .replace(/[\r\n\s]/g, "");
      const publicKeyBytes = Buffer.from(cleanBase64, "base64");

      const did = `did:web:${domain}`;
      const didDocument = {
        "@context": [
          "https://www.w3.org/ns/did/v1",
          "https://w3id.org/security/suites/jws-2020/v1",
        ],
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

  // GET /tenants/:tenantId/did
  fastify.get(
    "/:tenantId/did",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Tenant Management Architecture"],
        summary: "Fetch the DID document for this tenant",
        security: [{ bearerAuth: [] }],
        params: z.object({ tenantId: z.string().cuid() }),
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
          404: z.object({
            success: z.boolean(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.params as { tenantId: string };

      const tenantService = new TenantService(fastify.db);
      await tenantService.assertMembership(tenantId, req.identity.id);

      const did = await fastify.db.decentralizedIdentifier.findUnique({
        where: { tenantId },
      });
      if (!did) {
        return reply.status(404).send({
          success: false,
          error: "NOT_FOUND",
          message: "No DID provisioned for this tenant",
        });
      }
      return reply.send({
        success: true,
        data: { did: did.id, document: did.didDocument },
      });
    },
  );
}
