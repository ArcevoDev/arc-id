import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { config } from "@/core/config";

/**
 * Registers @fastify/jwt for use in auth-guard preHandler hooks.
 * Do NOT use fastify.jwt.sign() for token issuance —
 * use src/lib/jwt/jose.ts instead.
 */
export const jwtPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(fastifyJwt, {
      secret: config.jwt.secret,
    });
  },
  { name: "arc-id:jwt", dependencies: ["arc-id:db"] },
);
