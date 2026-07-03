// src/api/routes/did-document.route.ts
// Serves the global /.well-known/did.json for the ArcID deployment domain.
// Resolves the SYSTEM tenant's DID document.
//
// FIX: z.record(z.any()) is Zod v3 API. Zod v4 requires both key and value
// arguments: z.record(z.string(), z.any()). TSC error TS2554 resolved.

import type { FastifyInstance } from "fastify";
import { z } from "zod";

const DidDocumentSchema = z
  .record(z.string(), z.any())
  .describe("Valid W3C DID Document structure");

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});

export async function didDocumentRoute(fastify: FastifyInstance) {
  fastify.get(
    "/.well-known/did.json",
    {
      schema: {
        tags: ["Discovery"],
        summary: "Global did:web document for the ArcID deployment domain",
        response: {
          200: DidDocumentSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (_req, reply) => {
      const did = await fastify.db.decentralizedIdentifier.findFirst({
        where: { tenantId: "SYSTEM" },
        select: { didDocument: true },
      });

      if (!did?.didDocument) {
        return reply.status(404).send({
          error: "DID_NOT_PROVISIONED",
          message:
            "No DID has been provisioned for the SYSTEM tenant yet. POST /tenants/SYSTEM/did first.",
        });
      }

      return reply.send(did.didDocument as Record<string, any>);
    },
  );
}
