// src/modules/identity/identity.plugin.ts
//
// UPDATED: registers onboardingProgressRoute, which lives logically under
// /identity since it's the calling identity tracking their OWN onboarding
// progress (no tenant-admin permission needed — see onboarding.route.ts).

import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import { profileRoute } from "./routes/profile.route";
import { deviceRoute } from "./routes/device.route";
import { oauthLinkRoute } from "./routes/oauth-link.route";
import { delegationRoute } from "./routes/delegation.route";
import { adminRoute } from "./routes/admin.route";
import { onboardingProgressRoute } from "@/modules/tenant/routes/onboarding.route";

export const identityPlugin = fp(
  async (fastify: FastifyInstance) => {
    /**
     * Canonical Identity Namespace
     *
     * All identity-related routes MUST live under:
     *   /identity/*
     *
     * Examples:
     *   GET    /identity/profile
     *   PATCH  /identity/profile
     *   GET    /identity/devices
     *   DELETE /identity/devices/:id
     *   GET    /identity/oauth-links
     *   POST   /identity/delegations
     *   GET    /identity/admin
     *   POST   /identity/onboarding/start                  ← NEW
     *   GET    /identity/onboarding/:progressId             ← NEW
     *   POST   /identity/onboarding/:progressId/advance     ← NEW
     */

    await fastify.register(
      async (identityScope) => {
        const withZod = identityScope.withTypeProvider<ZodTypeProvider>();

        await withZod.register(profileRoute);
        await withZod.register(deviceRoute);
        await withZod.register(oauthLinkRoute);
        await withZod.register(delegationRoute);
        await withZod.register(adminRoute);
        await withZod.register(onboardingProgressRoute);
      },

      {
        prefix: "/identity",
      },
    );
  },
  { name: "arc-id:identity", dependencies: ["arc-id:db", "arc-id:auth-guard"] },
);
