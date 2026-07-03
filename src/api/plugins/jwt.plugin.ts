// src/api/plugins/jwt.plugin.ts
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { config } from "@/core/config";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Resolves PEM key content from either:
 * - A raw PEM string (starts with "-----BEGIN")
 * - A filesystem path to a .pem file
 * - Returns empty string if path doesn't exist or input is empty
 */
function resolvePemContent(keyOrPath: string): string {
  if (!keyOrPath || keyOrPath.trim() === "") return "";
  if (keyOrPath.includes("-----BEGIN")) return keyOrPath.trim();
  try {
    return readFileSync(resolve(process.cwd(), keyOrPath), "utf-8").trim();
  } catch {
    return "";
  }
}

/**
 * Registers @fastify/jwt with algorithm auto-detection:
 *  - RS256 when PRIVATE_KEY_PEM + PUBLIC_KEY_PEM resolve to real PEM content
 *  - HS256 (JWT_SECRET) when no RSA keys are present
 *
 * CRITICAL: This MUST match the algorithm selection in token.service.ts.
 * Both use resolvePemContent() to make the decision identically.
 */
export const jwtPlugin = fp(
  async (fastify: FastifyInstance) => {
    const privateKeyPem = resolvePemContent(config.security.jwt.privateKey);
    const publicKeyPem = resolvePemContent(config.security.jwt.publicKey);
    const useRsa = Boolean(privateKeyPem && publicKeyPem);

    if (useRsa) {
      fastify.log.info(
        "[JWT] Using RS256 asymmetric key pair for token verification",
      );
      await fastify.register(fastifyJwt, {
        secret: {
          private: privateKeyPem,
          public: publicKeyPem,
        },
        sign: { algorithm: "RS256" },
        verify: {
          algorithms: ["RS256"],
          // audience check is NOT enforced here — handled per-route if needed
        },
      });
    } else {
      fastify.log.info(
        "[JWT] Using HS256 symmetric secret for token verification",
      );
      await fastify.register(fastifyJwt, {
        secret: config.security.jwt.secret,
        sign: { algorithm: "HS256" },
        verify: {
          algorithms: ["HS256"],
        },
      });
    }
  },
  { name: "arc-id:jwt", dependencies: ["arc-id:db"] },
);

// Export the resolver so token.service.ts can use the SAME logic
export { resolvePemContent };
