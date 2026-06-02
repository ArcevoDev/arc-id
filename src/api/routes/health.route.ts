import type { FastifyInstance } from "fastify";

/**
 * Basic liveness probe. Separate from under-pressure /health/pressure.
 */
export async function healthRoute(fastify: FastifyInstance) {
  fastify.get("/health", async () => ({
    status: "healthy",
    system: "ArcID Core Engine",
    ts: new Date().toISOString(),
  }));
}
