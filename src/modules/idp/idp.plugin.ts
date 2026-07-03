// src/modules/idp/idp.plugin.ts
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { idpRoute } from "./routes/idp.route";

export const idpPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(
      async (idpScope) => {
        const withZod = idpScope.withTypeProvider<ZodTypeProvider>();
        await withZod.register(idpRoute);
      },
      { prefix: "/idp" },
    );
  },
  {
    name: "arc-id:idp",
    dependencies: ["arc-id:db", "arc-id:auth-guard"],
  },
);
