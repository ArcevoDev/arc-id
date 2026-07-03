import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import { subscriptionRoute } from "./routes/subscription.route";

export const billingPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(
      async (billingScope) => {
        const withZod = billingScope.withTypeProvider<ZodTypeProvider>();

        await withZod.register(subscriptionRoute);
      },
      {
        prefix: "/billing",
      },
    );
  },

  {
    name: "arc-id:billing",
    dependencies: ["arc-id:db", "arc-id:auth-guard"],
  },
);
