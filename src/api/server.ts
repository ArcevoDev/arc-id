import "dotenv/config";
import { config } from "@/core/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import underPressure from "@fastify/under-pressure";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { errorHandler } from "@/core/errors/error-handler";
import { startWebhookWorker } from "@/jobs/webhook-worker";

// ─── Infrastructure Plugins ───────────────────────────────────────────────────
import { dbPlugin } from "./plugins/db.plugin";
import { jwtPlugin } from "./plugins/jwt.plugin";
import { authGuardPlugin } from "./plugins/auth-guard.plugin";
import { rateLimitPlugin } from "./plugins/rate-limit.plugin";
import {
  swaggerGeneratorPlugin,
  swaggerUiPlugin,
} from "./plugins/swagger.plugin";

// ─── Protocol Routes ──────────────────────────────────────────────────────────
import { healthRoute } from "./routes/health.route";
import { openIdConfigurationRoute } from "./routes/openid-configuration.route";
import { didDocumentRoute } from "./routes/did-document.route";
import { mailPreviewRoute } from "./routes/mail-preview.route";

// ─── Domain Modules ───────────────────────────────────────────────────────────
import { authPlugin } from "@/modules/auth/auth.plugin";
import { oauthPlugin } from "@/modules/oauth/oauth.plugin";
import { identityPlugin } from "@/modules/identity/identity.plugin";
import { tenantPlugin } from "@/modules/tenant/tenant.plugin";
import { credentialsPlugin } from "@/modules/credentials/credentials.plugin";
import { billingPlugin } from "@/modules/billing/billing.plugin";
import { auditPlugin } from "@/modules/audit/audit.plugin";

export async function buildServer() {
  const server = Fastify({
    logger: config.base.isProduction
      ? { level: "info" }
      : {
          transport: {
            target: "pino-pretty",
            options: { colorize: true },
          },
        },
  });

  // ── Zod Type Compilers ────────────────────────────────────────────────────
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  // ── Security Middleware ───────────────────────────────────────────────────
  await server.register(helmet, { contentSecurityPolicy: false });
  await server.register(cors, {
    origin: config.base.allowedOrigins,
    credentials: true,
  });

  // ── Resilience ────────────────────────────────────────────────────────────
  await server.register(underPressure, {
    maxEventLoopDelay: 1000,
    maxHeapUsedBytes: 1_000_000_000,
    exposeStatusRoute: "/health/pressure",
  });

  // ── Infrastructure (order matters) ────────────────────────────────────────
  await server.register(dbPlugin);
  await server.register(jwtPlugin);
  await server.register(authGuardPlugin);
  await server.register(rateLimitPlugin);

  // Mount the decoupled aesthetic UI plugin
  await server.register(swaggerGeneratorPlugin);
  await server.register(swaggerUiPlugin);

  // ── Global Error Handler ──────────────────────────────────────────────────
  server.setErrorHandler(errorHandler);

  // ── Protocol Routes ───────────────────────────────────────────────────────
  await server.register(healthRoute);
  await server.register(openIdConfigurationRoute);
  await server.register(didDocumentRoute);
  await server.register(mailPreviewRoute);

  // ── Domain Modules ────────────────────────────────────────────────────────
  await server.register(authPlugin);
  await server.register(oauthPlugin);
  await server.register(identityPlugin);
  await server.register(tenantPlugin);
  await server.register(credentialsPlugin);
  await server.register(billingPlugin);
  await server.register(auditPlugin);

  return server;
}

async function start() {
  const server = await buildServer();

  const shutdown = async (signal: string) => {
    server.log.info(`${signal} received — shutting down`);
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await server.listen({ port: config.base.port, host: "0.0.0.0" });
    startWebhookWorker();
    server.log.info(`ArcID Engine running on port ${config.base.port}`);
    server.log.info(`Swagger UI → http://localhost:${config.base.port}/docs`);
    if (!config.base.isProduction) {
      server.log.info(
        `Mail Preview → http://localhost:${config.base.port}/mail/preview`,
      );
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
