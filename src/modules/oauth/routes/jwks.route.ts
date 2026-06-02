import type { FastifyInstance } from "fastify";
import { exportJWK, importSPKI } from "jose";
import { z } from "zod";

export async function jwksRoute(fastify: FastifyInstance) {
  fastify.get(
    "/jwks",
    {
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "RFC 7517 JSON Web Key Set — global signing keys",
        response: {
          200: z.object({ keys: z.array(z.record(z.string(), z.any())) }),
        },
      },
    },
    async (req, reply) => {
      const keys = await fastify.db.tenantSigningKey.findMany({
        where: { status: "ACTIVE" }, // ← was isActive: true
      });

      const jwks = await Promise.all(
        keys.map(async (key) => {
          try {
            const pem = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(key.publicKey).toString("base64")}\n-----END PUBLIC KEY-----`;
            const cryptoKey = await importSPKI(pem, key.algorithm);
            const jwk = await exportJWK(cryptoKey);
            return { ...jwk, kid: key.kid, alg: key.algorithm, use: "sig" };
          } catch {
            return null;
          }
        }),
      );

      return reply.send({ keys: jwks.filter(Boolean) });
    },
  );
}
