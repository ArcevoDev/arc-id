// src/api/server/build-server.ts
//
// SECURITY FIX: contentSecurityPolicy: false replaced with a real CSP policy.
// HSTS is now explicit rather than relying on helmet defaults.
//
// CSP DESIGN:
//   API server — serves JSON, not HTML. Only Swagger UI (/docs) needs relaxed
//   script/style-src. All other routes serve JSON only.
//   Swagger UI requires 'unsafe-inline' for its bundle loader and inline styles.
//
// HSTS:
//   maxAge: 31536000 = 1 year (preload minimum)
//   includeSubDomains: true
//   Omitted in development (localhost != HTTPS)

import "dotenv/config";
import Fastify from "fastify";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import underPressure from "@fastify/under-pressure";

import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import { config } from "@/core/config";
import { errorHandler } from "@/core/errors";

import {
  dbPlugin,
  jwtPlugin,
  authGuardPlugin,
  rateLimitPlugin,
  swaggerGeneratorPlugin,
  swaggerUiPlugin,
} from "../plugins";

import { healthRoute } from "@/api/routes/health.route";
import { openIdConfigurationRoute } from "@/api/routes/openid-configuration.route";
import { didDocumentRoute } from "@/api/routes/did-document.route";
import { mailPreviewRoute } from "@/api/routes/mail-preview.route";

import { authPlugin } from "@/modules/auth/auth.plugin";
import { oauthPlugin } from "@/modules/oauth/oauth.plugin";
import { identityPlugin } from "@/modules/identity/identity.plugin";
import { tenantPlugin } from "@/modules/tenant/tenant.plugin";
import { credentialsPlugin } from "@/modules/credentials/credentials.plugin";
import { billingPlugin } from "@/modules/billing/billing.plugin";
import { auditPlugin } from "@/modules/audit/audit.plugin";
import { webhooksPlugin } from "@/modules/webhooks/webhooks.plugin";
import { idpPlugin } from "@/modules/idp/idp.plugin";

export async function buildServer() {
  const server = Fastify({
    logger: config.base.isProduction
      ? { level: config.base.logLevel }
      : {
          transport: {
            target: "pino-pretty",
            options: { colorize: true },
          },
        },
  });

  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  // ── Security headers ───────────────────────────────────────────────────────
  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Swagger UI bundle loader
        styleSrc: ["'self'", "'unsafe-inline'"], // Swagger UI inline styles
        imgSrc: ["'self'", "data:"], // Swagger UI icons
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(config.base.isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },

    strictTransportSecurity: config.base.isProduction
      ? { maxAge: 31536000, includeSubDomains: true }
      : false,

    frameguard: { action: "deny" },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    dnsPrefetchControl: { allow: false },
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
  });

  await server.register(cors, {
    origin: config.base.allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Idempotency-Key",
      "X-Request-ID",
    ],
    exposedHeaders: ["X-Request-ID", "Retry-After"],
  });

  await server.register(underPressure, {
    maxEventLoopDelay: 1000,
    maxHeapUsedBytes: 1_000_000_000,
    exposeStatusRoute: "/health/pressure",
  });

  await server.register(cookie, {
    secret: config.security.cookieSecret,
    parseOptions: {},
  });

  // ── Infrastructure ─────────────────────────────────────────────────────────
  await server.register(dbPlugin);
  await server.register(jwtPlugin);
  await server.register(authGuardPlugin);
  await server.register(rateLimitPlugin);
  await server.register(swaggerGeneratorPlugin);

  server.setErrorHandler(errorHandler);

  // ── Protocol routes ────────────────────────────────────────────────────────
  await server.register(healthRoute);
  await server.register(openIdConfigurationRoute);
  await server.register(didDocumentRoute);

  if (!config.base.isProduction) {
    await server.register(mailPreviewRoute);
  }

  // ── Versioned API ──────────────────────────────────────────────────────────
  await server.register(
    async (api) => {
      await api.register(authPlugin);
      await api.register(oauthPlugin);
      await api.register(identityPlugin);
      await api.register(tenantPlugin);
      await api.register(credentialsPlugin);
      await api.register(billingPlugin);
      await api.register(auditPlugin);
      await api.register(webhooksPlugin);
      await api.register(idpPlugin);
    },
    { prefix: "/api/v1" },
  );

  await server.register(swaggerUiPlugin);

  return server;
}
