import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { tenantRoute } from "./routes/tenant.route";
import { membershipRoute } from "./routes/membership.route";
import { policyRoute } from "./routes/policy.route";
import { signingKeyRoute } from "./routes/signing-key.route";
import { tenantDidRoute } from "./routes/did.route";

export const tenantPlugin = fp(
  async (fastify: FastifyInstance) => {
    // Bind the type provider compilation engine to the tenant module scope
    const withZod = fastify.withTypeProvider<ZodTypeProvider>();

    await withZod.register(tenantRoute);
    await withZod.register(membershipRoute);
    await withZod.register(policyRoute);
    await withZod.register(signingKeyRoute);
    await withZod.register(tenantDidRoute);
  },
  { name: "arc-id:tenant", dependencies: ["arc-id:db", "arc-id:auth-guard"] },
);
