import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { profileRoute } from "./routes/profile.route";
import { deviceRoute } from "./routes/device.route";
import { oauthLinkRoute } from "./routes/oauth-link.route";
import { delegationRoute } from "./routes/delegation.route";
import { adminRoute } from "./routes/admin.route";

export const identityPlugin = fp(
  async (fastify: FastifyInstance) => {
    const withZod = fastify.withTypeProvider<ZodTypeProvider>();

    await withZod.register(profileRoute);
    await withZod.register(deviceRoute);
    await withZod.register(oauthLinkRoute);
    await withZod.register(delegationRoute);
    await withZod.register(adminRoute);
  },
  { name: "arc-id:identity", dependencies: ["arc-id:db", "arc-id:auth-guard"] },
);
