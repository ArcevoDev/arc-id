import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function didRoute(fastify: FastifyInstance) {
  fastify.get(
    "/tenants/:slug/did.json",
    {
      schema: {
        tags: ["Decentralized Identifier (DID) Documents"],
        summary: "Resolve a tenant's public W3C DID document representation",
        description:
          "Public tracking checkpoint allowing external third-party tools to fetch public cryptographic signing keys.",
        params: z.object({
          slug: z.string().min(1, "Tenant slug is required"),
        }),
        response: {
          200: z.record(z.string(), z.any()), // Dynamic object representing arbitrary W3C standardized maps
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const tenant = await fastify.db.tenant.findUnique({
        where: { slug },
        include: { did: true },
      });
      if (!tenant?.did) return reply.status(404).send({ error: "NOT_FOUND" });
      return reply.send(tenant.did.didDocument);
    },
  );
}
