// src/modules/tenant/tenant.plugin.ts
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
    /**
     * All tenant routes are mounted under /tenants.
     * Canonical paths:
     *   POST   /tenants                            — create tenant
     *   GET    /tenants/:slug                      — get by slug
     *   GET    /tenants/:slug/jwks                 — JWKS for tenant signing keys
     *   POST   /tenants/:tenantId/members          — add member
     *   DELETE /tenants/:tenantId/members/:id      — remove member
     *   GET    /tenants/:tenantId/policy           — get policy
     *   PATCH  /tenants/:tenantId/policy           — update policy
     *   POST   /tenants/:tenantId/signing-keys     — generate signing key
     *   GET    /tenants/:tenantId/signing-keys     — list signing keys
     *   DELETE /tenants/:tenantId/signing-keys/:kid — revoke key
     *   POST   /tenants/:tenantId/did              — provision DID
     *   GET    /tenants/:tenantId/did              — get DID document
     */
    fastify.register(
      async (tenantScope) => {
        const withZod = tenantScope.withTypeProvider<ZodTypeProvider>();
        await withZod.register(tenantRoute);
        await withZod.register(membershipRoute);
        await withZod.register(policyRoute);
        await withZod.register(signingKeyRoute);
        await withZod.register(tenantDidRoute);
      },
      { prefix: "/tenants" },
    );
  },
  { name: "arc-id:tenant", dependencies: ["arc-id:db", "arc-id:auth-guard"] },
);
