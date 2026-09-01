// src/modules/api-key/api-key.plugin.ts
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { apiKeyRoute } from "./routes/api-key.route";

export const apiKeyPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(
      async (scope) => {
        const withZod = scope.withTypeProvider<ZodTypeProvider>();

        await withZod.register(apiKeyRoute);
      },
      { prefix: "/api-keys" },
    );
  },
  { name: "arc-id:api-key", dependencies: ["arc-id:db", "arc-id:auth-guard"] },
);
