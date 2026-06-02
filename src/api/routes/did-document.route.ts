import type { FastifyInstance } from "fastify";

/**
 * did:web resolution endpoint.
 * GET /.well-known/did.json  →  root DID document
 * GET /tenants/:slug/did.json → tenant DID document
 * Actual document construction is handled by credentials/services/did.service.ts
 */
export async function didDocumentRoute(fastify: FastifyInstance) {
  fastify.get("/.well-known/did.json", async (req, reply) => {
    return reply.status(501).send({ message: "Not yet implemented" });
  });
}
