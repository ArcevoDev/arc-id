import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import { config } from "@/core/config";

const SWAGGER_DESCRIPTION = `
## ArcID — Sovereign Identity Engine

ArcID is a high-performance, multi-tenant identity platform integrating traditional OAuth2/OIDC flows with W3C Decentralized Identity (DID) and Verifiable Credential (VC) standards.

### Core Architecture Modules:
* **Identity & Auth:** Central user registry, Passkey/MFA/Local account security, and session management.
* **SSI / DID Layer:** Decentralized identifier management and Verifiable Credential issuance/verification.
* **Multi-Tenancy:** Siloed tenant management with custom branding, SSO (SAML/OIDC), and signing keys.
* **RBAC / Authorization:** Fine-grained dynamic roles and permissions for enterprise access control.
* **Governance:** Audit logging, webhook event processing, and legal consent tracking.
`;

const customCss = `
  body { background-color: #fafafa; font-family: 'Inter', system-ui, sans-serif; }
  .swagger-ui .topbar { background-color: #09090b; padding: 14px 0; border-bottom: 1px solid #27272a; }
  .swagger-ui .topbar-wrapper::before { content: 'ArcID System Kernel'; color: #ffffff; font-weight: 700; font-size: 1.25rem; }
  .swagger-ui .opblock { border-radius: 8px; border: 1px solid #e4e4e7; }
  .swagger-ui .btn.execute { background-color: #09090b; border-radius: 6px; font-weight: 600; }
`;

export const swaggerGeneratorPlugin = fp(
  async (fastify) => {
    await fastify.register(fastifySwagger, {
      openapi: {
        info: {
          title: "ArcID — Sovereign Identity Engine",
          description: SWAGGER_DESCRIPTION,
          version: "0.1.0",
        },
        servers: [
          {
            url: `http://localhost:${config.base.port}`,
            description: "Local Dev",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          },
        },
      },
      transform: jsonSchemaTransform,
    });
  },
  { name: "arc-id:swagger-gen" },
);

export const swaggerUiPlugin = fp(
  async (fastify) => {
    await fastify.register(fastifySwaggerUi, {
      routePrefix: "/docs",
      theme: {
        title: "ArcID Interface Portal",
        css: [{ filename: "theme.css", content: customCss }],
      },
    });
  },
  { name: "arc-id:swagger-ui", dependencies: ["arc-id:swagger-gen"] },
);
