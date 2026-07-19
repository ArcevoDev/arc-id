// src/modules/tenant/routes/project.route.ts
//
// NEW MODULE. Mounted under the existing /tenants prefix (see tenant.plugin.ts),
// following the exact same convention as signing-key.route.ts and did.route.ts.
//
// Canonical paths:
//   POST   /tenants/:tenantId/projects             — create a project
//   GET    /tenants/:tenantId/projects             — list projects (optionally ?category=)
//   GET    /tenants/:tenantId/projects/:projectId  — get one project + its clients/flows
//   PATCH  /tenants/:tenantId/projects/:projectId  — update name/category
//   DELETE /tenants/:tenantId/projects/:projectId  — delete a project
//
// Authorization: any active tenant member can list/read; only members with
// the project:manage permission can create/update/delete.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { auditService } from "@/modules/audit/services/audit.service";
import { ProjectService } from "../services/project.service";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectParamsSchema,
  TenantParamsSchema,
  ListProjectsQuerySchema,
} from "../validators/project.schemas";

export async function projectRoute(fastify: FastifyInstance) {
  // ── POST /:tenantId/projects ────────────────────────────────────────────
  fastify.post(
    "/:tenantId/projects",
    {
      preHandler: [
        fastify.auth.requireUser,
        fastify.auth.requirePermission("project:manage"),
      ],
      schema: {
        tags: ["Project Management"],
        summary: "Create a new project (product/section) under this tenant",
        security: [{ bearerAuth: [] }],
        params: TenantParamsSchema,
        body: CreateProjectSchema,
        response: {
          201: z.object({ success: z.boolean(), data: z.any() }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.params as { tenantId: string };
      const body = req.body as z.infer<typeof CreateProjectSchema>;

      const projectService = new ProjectService(fastify.db);
      const project = await projectService.create(tenantId, body);

      void auditService
        .log({
          action: "TENANT_UPDATED",
          identityId: req.identity.id,
          tenantId,
          ip: req.ip,
          metadata: {
            event: "project_created",
            projectId: project.id,
            slug: project.slug,
          },
        })
        .catch(() => {});

      return reply.status(201).send({ success: true, data: project });
    },
  );

  // ── GET /:tenantId/projects ─────────────────────────────────────────────
  fastify.get(
    "/:tenantId/projects",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Project Management"],
        summary:
          "List projects under this tenant, optionally filtered by category",
        security: [{ bearerAuth: [] }],
        params: TenantParamsSchema,
        querystring: ListProjectsQuerySchema,
        response: {
          200: z.object({ success: z.boolean(), data: z.array(z.any()) }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId } = req.params as { tenantId: string };
      const { category } = req.query as { category?: string };

      const projectService = new ProjectService(fastify.db);
      await projectService.assertMembership(tenantId, req.identity.id);

      const projects = await projectService.list(tenantId, category);
      return reply.send({ success: true, data: projects });
    },
  );

  // ── GET /:tenantId/projects/:projectId ──────────────────────────────────
  fastify.get(
    "/:tenantId/projects/:projectId",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Project Management"],
        summary:
          "Get a single project, including its OAuth clients and onboarding flows",
        security: [{ bearerAuth: [] }],
        params: ProjectParamsSchema,
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId, projectId } = req.params as {
        tenantId: string;
        projectId: string;
      };

      const projectService = new ProjectService(fastify.db);
      await projectService.assertMembership(tenantId, req.identity.id);

      const project = await projectService.getById(tenantId, projectId);
      return reply.send({ success: true, data: project });
    },
  );

  // ── PATCH /:tenantId/projects/:projectId ────────────────────────────────
  fastify.patch(
    "/:tenantId/projects/:projectId",
    {
      preHandler: [
        fastify.auth.requireUser,
        fastify.auth.requirePermission("project:manage"),
      ],
      schema: {
        tags: ["Project Management"],
        summary: "Update a project's name or category",
        security: [{ bearerAuth: [] }],
        params: ProjectParamsSchema,
        body: UpdateProjectSchema,
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId, projectId } = req.params as {
        tenantId: string;
        projectId: string;
      };
      const body = req.body as z.infer<typeof UpdateProjectSchema>;

      const projectService = new ProjectService(fastify.db);
      const project = await projectService.update(tenantId, projectId, body);

      void auditService
        .log({
          action: "TENANT_UPDATED",
          identityId: req.identity.id,
          tenantId,
          ip: req.ip,
          metadata: { event: "project_updated", projectId },
        })
        .catch(() => {});

      return reply.send({ success: true, data: project });
    },
  );

  // ── DELETE /:tenantId/projects/:projectId ───────────────────────────────
  fastify.delete(
    "/:tenantId/projects/:projectId",
    {
      preHandler: [
        fastify.auth.requireElevated,
        fastify.auth.requirePermission("project:manage"),
      ],
      schema: {
        tags: ["Project Management"],
        summary:
          "Delete a project (requires step-up re-authentication). OAuth clients built on it are NOT deleted — they fall back to tenant-level.",
        security: [{ bearerAuth: [] }],
        params: ProjectParamsSchema,
        response: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    async (req, reply) => {
      const { tenantId, projectId } = req.params as {
        tenantId: string;
        projectId: string;
      };

      const projectService = new ProjectService(fastify.db);
      await projectService.delete(tenantId, projectId);

      void auditService
        .log({
          action: "TENANT_UPDATED",
          identityId: req.identity.id,
          tenantId,
          ip: req.ip,
          metadata: { event: "project_deleted", projectId },
        })
        .catch(() => {});

      return reply.send({ success: true });
    },
  );
}
