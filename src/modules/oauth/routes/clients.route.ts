// src/modules/oauth/routes/clients.route.ts
//
// UPDATED: OAuth clients can now optionally be scoped to a Project
// (ArcID, ArcWallet, ArcVerify, etc) via projectId, in addition to the
// existing tenantId scoping. projectId is OPTIONAL — existing clients with
// no project (e.g. the SYSTEM tenant's direct-login client) are unaffected.
//
// When projectId is supplied at creation, it's validated to belong to the
// target tenant (a project from a different tenant can't be attached to
// this client — that would be a cross-tenant data leak).
//
// GET /clients now also accepts ?projectId= to filter the list down to one
// product's OAuth apps, which is the whole point of adding this field —
// previously, 5 products registering clients under one tenant were
// indistinguishable from each other in the list view.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashPassword } from "@/modules/auth/services/password.service";
import { generateToken } from "@/lib/crypto";
import { ApiError } from "@/core/errors";
import { hasPermission } from "@/lib/security/rbac";

const CreateClientSchema = z.object({
  name: z.string().min(1),
  grantTypes: z
    .array(
      z.enum(["authorization_code", "refresh_token", "client_credentials"]),
    )
    .default(["authorization_code", "refresh_token"]),
  scopes: z.array(z.string()).default(["openid", "profile", "email"]),
  redirectUris: z.array(z.string().url()).default([]),
  public: z.boolean().default(false),
  requirePkce: z.boolean().default(true),
  tenantId: z.string().cuid().optional(),
  projectId: z.string().cuid().optional(), // ← NEW
  logoUri: z.string().url().optional(),
  tosUri: z.string().url().optional(),
  policyUri: z.string().url().optional(),
});

/**
 * Validates that, if projectId is supplied, the project actually belongs to
 * targetTenantId. Prevents attaching a client to a project owned by a
 * different tenant — which would otherwise let a tenant ADMIN silently
 * leak association data about a project they don't own.
 */
async function assertProjectBelongsToTenant(
  fastify: FastifyInstance,
  projectId: string,
  targetTenantId: string,
) {
  const project = await fastify.db.project.findFirst({
    where: { id: projectId, tenantId: targetTenantId },
    select: { id: true },
  });
  if (!project) {
    throw ApiError.badRequest(
      "projectId does not exist or does not belong to this tenant",
    );
  }
}

export async function clientsRoute(fastify: FastifyInstance) {
  // POST /oauth/clients
  fastify.post(
    "/clients",
    {
      preHandler: fastify.auth.requirePlan("PRO"),
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary:
          "Register an OAuth application client — requires PRO plan + ADMIN role (PRO)",
        security: [{ bearerAuth: [] }],
        body: CreateClientSchema,
        response: {
          201: z.object({
            success: z.boolean(),
            data: z.object({
              clientId: z.string(),
              clientSecret: z.string().nullable(),
              name: z.string(),
              projectId: z.string().nullable(),
              grantTypes: z.array(z.string()),
              scopes: z.array(z.string()),
              redirectUris: z.array(z.string()),
              public: z.boolean(),
              requirePkce: z.boolean(),
            }),
          }),
        },
      },
    },
    async (req, reply) => {
      const input = CreateClientSchema.parse(req.body);
      const targetTenantId =
        input.tenantId ?? req.identity.tenantId ?? "SYSTEM";

      if (
        !(await hasPermission(
          fastify.db,
          req.identity.id,
          targetTenantId,
          "client:create",
        ))
      ) {
        throw ApiError.forbidden("Permission required: client:create");
      }

      if (input.projectId) {
        await assertProjectBelongsToTenant(
          fastify,
          input.projectId,
          targetTenantId,
        );
      }

      const clientId = generateToken(16);
      const clientSecret = input.public ? null : generateToken(32);
      const secretHash = clientSecret ? await hashPassword(clientSecret) : null;

      const client = await fastify.db.client.create({
        data: {
          name: input.name,
          clientId,
          clientSecret: secretHash,
          grantTypes: input.grantTypes,
          scopes: input.scopes,
          public: input.public,
          requirePkce: input.requirePkce,
          tenantId: targetTenantId,
          projectId: input.projectId ?? null,
          logoUri: input.logoUri,
          tosUri: input.tosUri,
          policyUri: input.policyUri,
          redirectUris: { create: input.redirectUris.map((uri) => ({ uri })) },
        },
        include: { redirectUris: true },
      });

      await fastify.db.auditLog.create({
        data: {
          actionId: "OAUTH_CLIENT_CREATED",
          tenantId: targetTenantId,
          identityId: req.identity.id,
          ip: req.ip,
          metadata: {
            clientId,
            name: input.name,
            projectId: input.projectId ?? null,
          },
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          clientId,
          clientSecret: clientSecret ?? null,
          name: client.name,
          projectId: client.projectId,
          grantTypes: client.grantTypes as string[],
          scopes: client.scopes as string[],
          redirectUris: (client.redirectUris as Array<{ uri: string }>).map(
            (r) => r.uri,
          ),
          public: client.public,
          requirePkce: client.requirePkce,
        },
      });
    },
  );

  // GET /oauth/clients
  fastify.get(
    "/clients",
    {
      preHandler: fastify.auth.requirePlan("PRO"),
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary:
          "List OAuth clients for your active tenant, optionally filtered by project (PRO)",
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          tenantId: z.string().cuid().optional(),
          projectId: z.string().cuid().optional(), // ← NEW
        }),
        response: {
          200: z.object({ success: z.boolean(), data: z.array(z.any()) }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId, projectId } = req.query as {
        tenantId?: string;
        projectId?: string;
      };
      const targetTenantId = tenantId ?? req.identity.tenantId ?? "SYSTEM";

      if (
        !(await hasPermission(
          fastify.db,
          req.identity.id,
          targetTenantId,
          "client:read",
        ))
      ) {
        throw ApiError.forbidden("Permission required: client:read");
      }

      const clients = await fastify.db.client.findMany({
        where: {
          tenantId: targetTenantId,
          ...(projectId ? { projectId } : {}),
        },
        select: {
          id: true,
          name: true,
          clientId: true,
          public: true,
          grantTypes: true,
          scopes: true,
          tenantId: true,
          projectId: true,
          createdAt: true,
          requirePkce: true,
          redirectUris: { select: { uri: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ success: true, data: clients });
    },
  );

  // DELETE /oauth/clients/:clientId
  fastify.delete(
    "/clients/:clientId",
    {
      preHandler: fastify.auth.requirePlan("PRO"),
      schema: {
        tags: ["OAuth2 / OIDC Server"],
        summary: "Delete an OAuth client (PRO)",
        security: [{ bearerAuth: [] }],
        params: z.object({ clientId: z.string().min(1) }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const { clientId } = req.params as { clientId: string };
      const client = await fastify.db.client.findFirst({ where: { clientId } });
      if (!client) throw ApiError.notFound("Client not found");

      const clientTenantId = client.tenantId ?? "SYSTEM";
      if (
        !(await hasPermission(
          fastify.db,
          req.identity.id,
          clientTenantId,
          "client:delete",
        ))
      ) {
        throw ApiError.forbidden("Permission required: client:delete");
      }
      await fastify.db.client.delete({ where: { id: client.id } });

      return reply.send({ success: true });
    },
  );
}
