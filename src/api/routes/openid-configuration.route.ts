// src/api/routes/openid-configuration.route.ts
import type { FastifyInstance } from "fastify";
import { config } from "@/core/config";
import { z } from "zod";
import { resolvePemContent } from "@/api/plugins/jwt.plugin";

/**
 * RFC 8414 — OAuth 2.0 Authorization Server Metadata
 * Consumed by OIDC relying parties to discover endpoints.
 *
 * id_token_signing_alg_values_supported is determined at runtime by the
 * same PEM-resolution logic used by jwt.plugin.ts and token.service.ts,
 * so this document always reflects the actual active algorithm.
 *
 * FIX: Previous version listed ["HS256", "ES256"] unconditionally.
 *   - ES256 is never used anywhere in the codebase — removed.
 *   - Algorithm is now resolved once at startup using the same
 *     resolvePemContent() path that jwt.plugin.ts and token.service.ts use,
 *     so the advertised value always matches what the server actually signs with.
 *   - Result: ["RS256"] when PRIVATE_KEY_PEM + PUBLIC_KEY_PEM resolve,
 *             ["HS256"] when only JWT_SECRET is configured.
 */
export async function openIdConfigurationRoute(fastify: FastifyInstance) {
  // Resolve once at server startup — algorithm never changes at runtime.
  const privateKeyPem = resolvePemContent(config.security.jwt.privateKey);
  const publicKeyPem = resolvePemContent(config.security.jwt.publicKey);
  const activeAlgorithms =
    privateKeyPem && publicKeyPem ? ["RS256"] : ["HS256"];

  fastify.get(
    "/.well-known/openid-configuration",
    {
      schema: {
        tags: ["Discovery & Protocol Architecture"],
        summary:
          "OIDC OpenID Provider / Authorization Server metadata discovery descriptor",
        response: {
          200: z.object({
            issuer: z.string().url(),
            authorization_endpoint: z.string().url(),
            token_endpoint: z.string().url(),
            userinfo_endpoint: z.string().url(),
            jwks_uri: z.string().url(),
            revocation_endpoint: z.string().url(),
            introspection_endpoint: z.string().url(),
            response_types_supported: z.array(z.string()),
            grant_types_supported: z.array(z.string()),
            subject_types_supported: z.array(z.string()),
            id_token_signing_alg_values_supported: z.array(z.string()),
            scopes_supported: z.array(z.string()),
            token_endpoint_auth_methods_supported: z.array(z.string()),
            code_challenge_methods_supported: z.array(z.string()),
          }),
        },
      },
    },
    async (req) => {
      const base = config.base.apiUrl ?? `http://${req.hostname}`;
      return {
        issuer: base,
        authorization_endpoint: `${base}/api/v1/oauth/authorize`,
        token_endpoint: `${base}/api/v1/oauth/token`,
        userinfo_endpoint: `${base}/api/v1/oauth/userinfo`,
        jwks_uri: `${base}/api/v1/oauth/jwks`,
        revocation_endpoint: `${base}/api/v1/oauth/revoke`,
        introspection_endpoint: `${base}/api/v1/oauth/introspect`,
        response_types_supported: ["code"],
        grant_types_supported: [
          "authorization_code",
          "refresh_token",
          "client_credentials",
        ],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: activeAlgorithms,
        scopes_supported: ["openid", "profile", "email", "offline_access"],
        token_endpoint_auth_methods_supported: [
          "client_secret_post",
          "client_secret_basic",
          "none",
        ],
        code_challenge_methods_supported: ["S256"],
      };
    },
  );
}
