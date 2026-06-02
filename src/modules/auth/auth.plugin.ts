import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import { registerRoute } from "./routes/register.route";
import { loginRoute } from "./routes/login.route";
import { logoutRoute } from "./routes/logout.route";
import { sessionRoute } from "./routes/session.route";
import { mfaRoute } from "./routes/mfa.route";
import { passkeyRoute } from "./routes/passkey.route";
import { passwordRoute } from "./routes/password.route";
import { emailVerifyRoute } from "./routes/email-verify.route";
import { magicLinkRoute } from "./routes/magic-link.route";
import { switchContextRoute } from "./routes/switch-context.route";

export const authPlugin = fp(
  async (fastify: FastifyInstance) => {
    // Coerce global scope tracking down to the explicit Zod parsing engine type context
    const withZod = fastify.withTypeProvider<ZodTypeProvider>();

    await withZod.register(registerRoute);
    await withZod.register(loginRoute);
    await withZod.register(logoutRoute);
    await withZod.register(sessionRoute);
    await withZod.register(mfaRoute);
    await withZod.register(passkeyRoute);
    await withZod.register(passwordRoute);
    await withZod.register(emailVerifyRoute);
    await withZod.register(magicLinkRoute);
    await withZod.register(switchContextRoute);
  },
  { name: "arc-id:auth", dependencies: ["arc-id:db", "arc-id:jwt"] },
);
