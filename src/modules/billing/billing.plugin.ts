import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { subscriptionRoute } from "./routes/subscription.route";

export const billingPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(subscriptionRoute);
  },
  { name: "arc-id:billing", dependencies: ["arc-id:db", "arc-id:auth-guard"] },
);
