import type { FastifyInstance } from "fastify";
import { config } from "@/core/config";
import { z } from "zod";

/**
 * RFC 8414 — OAuth 2.0 Authorization Server Metadata
 * Consumed by OIDC relying parties to discover endpoints.
 */
export async function openIdConfigurationRoute(fastify: FastifyInstance) {
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
        authorization_endpoint: `${base}/oauth/authorize`,
        token_endpoint: `${base}/oauth/token`,
        userinfo_endpoint: `${base}/oauth/userinfo`,
        jwks_uri: `${base}/oauth/jwks`,
        revocation_endpoint: `${base}/oauth/revoke`,
        introspection_endpoint: `${base}/oauth/introspect`,
        response_types_supported: ["code"],
        grant_types_supported: [
          "authorization_code",
          "refresh_token",
          "client_credentials",
        ],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["HS256", "ES256"],
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
