import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

/**
 * Global rate limiting. Auth endpoints apply tighter limits
 * via their own preHandler or by passing { config: { rateLimit: {...} } }
 * to individual routes.
 */
export const rateLimitPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(rateLimit, {
      global: true,
      max: 200,
      timeWindow: "1 minute",
      keyGenerator: (req) => req.ip,
      errorResponseBuilder: () => ({
        success: false,
        error: "TOO_MANY_REQUESTS",
        message: "Rate limit exceeded. Please slow down.",
      }),
    });
  },
  { name: "arc-id:rate-limit" },
);
