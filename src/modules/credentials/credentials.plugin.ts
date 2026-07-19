import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import { didRoute } from "./routes/did.route";
import { issueRoute } from "./routes/issue.route";
import { offerRoute } from "./routes/offer.route";
import { revokeRoute } from "./routes/revoke.route";
import { statusRoute } from "./routes/status.route";
import { verifyRoute } from "./routes/verify.route";

export const credentialsPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(
      async (credentialsScope) => {
        const withZod = credentialsScope.withTypeProvider<ZodTypeProvider>();

        await withZod.register(didRoute);
        await withZod.register(issueRoute);
        await withZod.register(offerRoute);
        await withZod.register(revokeRoute);
        await withZod.register(statusRoute);
        await withZod.register(verifyRoute);
      },
      {
        prefix: "/credentials",
      },
    );
  },
  { name: "arc-id:credentials", dependencies: ["arc-id:db", "arc-id:jwt"] },
);
