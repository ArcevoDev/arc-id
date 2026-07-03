// src/modules/tenant/tenant.plugin.ts
//
// UPDATED: registers the two new route modules — projectRoute and
// onboardingFlowRoute — alongside the existing tenant routes. Both new
// modules use paths nested under /tenants/:tenantId/projects/..., which is
// why they belong in this plugin rather than a standalone one.

import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { tenantRoute } from "./routes/tenant.route";
import { membershipRoute } from "./routes/membership.route";
import { policyRoute } from "./routes/policy.route";
import { signingKeyRoute } from "./routes/signing-key.route";
import { tenantDidRoute } from "./routes/did.route";
import { projectRoute } from "./routes/project.route";
import { onboardingFlowRoute } from "./routes/onboarding.route";

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
     *
     *   POST   /tenants/:tenantId/projects                                — create project       ← NEW
     *   GET    /tenants/:tenantId/projects                                — list projects         ← NEW
     *   GET    /tenants/:tenantId/projects/:projectId                     — get project           ← NEW
     *   PATCH  /tenants/:tenantId/projects/:projectId                     — update project        ← NEW
     *   DELETE /tenants/:tenantId/projects/:projectId                     — delete project         ← NEW
     *
     *   POST   /tenants/:tenantId/projects/:projectId/onboarding-flows           — create flow    ← NEW
     *   GET    /tenants/:tenantId/projects/:projectId/onboarding-flows           — list flows     ← NEW
     *   GET    /tenants/:tenantId/projects/:projectId/onboarding-flows/:flowId   — get flow        ← NEW
     *   PATCH  /tenants/:tenantId/projects/:projectId/onboarding-flows/:flowId   — update flow     ← NEW
     *   DELETE /tenants/:tenantId/projects/:projectId/onboarding-flows/:flowId   — delete flow      ← NEW
     */
    await fastify.register(
      async (tenantScope) => {
        const withZod = tenantScope.withTypeProvider<ZodTypeProvider>();

        await withZod.register(tenantRoute);
        await withZod.register(membershipRoute);
        await withZod.register(policyRoute);
        await withZod.register(signingKeyRoute);
        await withZod.register(tenantDidRoute);
        await withZod.register(projectRoute);
        await withZod.register(onboardingFlowRoute);
      },
      { prefix: "/tenants" },
    );
  },
  { name: "arc-id:tenant", dependencies: ["arc-id:db", "arc-id:auth-guard"] },
);
