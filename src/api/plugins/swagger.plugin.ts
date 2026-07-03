// src/api/plugins/swagger.plugin.ts

import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

const SWAGGER_DESCRIPTION = `
## ArcID — Sovereign Identity Engine
ArcID is a high-performance, multi-tenant identity platform integrating traditional OAuth2/OIDC flows with W3C Decentralized Identity (DID) and Verifiable Credential (VC) standards.
`;

export const swaggerGeneratorPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(swagger, {
      mode: "dynamic",
      openapi: {
        openapi: "3.1.0",
        info: {
          title: "ArcID — Sovereign Identity Engine",
          description: SWAGGER_DESCRIPTION,
          version: "1.0.0-alpha",
        },
        servers: [
          {
            url: "http://localhost:4000",
            description: "Local development",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
      },
      // Clean transform — delegate entirely to jsonSchemaTransform.
      // No defensive heuristics, no response stripping, no silent catch.
      // If a route schema causes jsonSchemaTransform to throw, the error
      // will surface at startup so it can be fixed at the source.
      transform: jsonSchemaTransform,
    });
  },
  { name: "arc-id:swagger-gen" },
);

export const swaggerUiPlugin = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
        persistAuthorization: true,
        defaultModelRendering: "example", // Finishes your comment intent safely
      },
    });
  },
  { name: "arc-id:swagger-ui" },
);
