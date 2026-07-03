import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { authorizeRoute } from "./routes/authorize.route";
import { tokensRoute } from "./routes/tokens.route";
import { introspectRoute } from "./routes/introspect.route";
import { revokeRoute } from "./routes/revoke.route";
import { userinfoRoute } from "./routes/userinfo.route";
import { jwksRoute } from "./routes/jwks.route";
import { clientsRoute } from "./routes/clients.route";
import { consentRoute } from "./routes/consent.route";

export const oauthPlugin = fp(
  async (fastify: FastifyInstance) => {
    // Encapsulate all OAuth/OIDC engine specifications under /oauth prefix block
    await fastify.register(
      async (oAuthScope) => {
        const withZod = oAuthScope.withTypeProvider<ZodTypeProvider>();

        await withZod.register(authorizeRoute);
        await withZod.register(tokensRoute);
        await withZod.register(introspectRoute);
        await withZod.register(revokeRoute);
        await withZod.register(userinfoRoute);
        await withZod.register(jwksRoute);
        await withZod.register(clientsRoute);
        await withZod.register(consentRoute);
      },
      { prefix: "/oauth" },
    );
  },
  { name: "arc-id:oauth", dependencies: ["arc-id:db", "arc-id:jwt"] },
);
