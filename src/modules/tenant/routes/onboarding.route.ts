// src/modules/tenant/routes/onboarding.route.ts
//
// NEW MODULE. Two route groups in one file since they're small and tightly
// related:
//
// Admin-facing (flow management), mounted under /tenants prefix like
// project.route.ts:
//   POST   /tenants/:tenantId/projects/:projectId/onboarding-flows
//   GET    /tenants/:tenantId/projects/:projectId/onboarding-flows
//   GET    /tenants/:tenantId/projects/:projectId/onboarding-flows/:flowId
//   PATCH  /tenants/:tenantId/projects/:projectId/onboarding-flows/:flowId
//   DELETE /tenants/:tenantId/projects/:projectId/onboarding-flows/:flowId
//
// End-user facing (progress), mounted under /identity/onboarding —
// deliberately NOT under /tenants, since the calling identity is tracking
// their OWN progress and doesn't need tenant-admin permissions to do so:
//   POST   /identity/onboarding/start            { flowId }
//   GET    /identity/onboarding/:progressId
//   POST   /identity/onboarding/:progressId/advance   { stepId, data? }

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { auditService } from "@/modules/audit/services/audit.service";
import { ProjectService } from "../services/project.service";
import { OnboardingService } from "../services/onboarding.service";
import {
  CreateOnboardingFlowSchema,
  UpdateOnboardingFlowSchema,
  OnboardingFlowParamsSchema,
  ProjectFlowsParamsSchema,
  StartProgressSchema,
  AdvanceProgressSchema,
  ProgressParamsSchema,
} from "../validators/onboarding.schemas";

// ── Admin: flow management, mounted under /tenants ──────────────────────────
export async function onboardingFlowRoute(fastify: FastifyInstance) {
  fastify.post(
    "/:tenantId/projects/:projectId/onboarding-flows",
    {
      preHandler: [
        fastify.auth.requireUser,
        fastify.auth.requirePermission("onboarding:manage"),
      ],
      schema: {
        tags: ["Onboarding Flows"],
        summary: "Create an onboarding flow for a project",
        security: [{ bearerAuth: [] }],
        params: ProjectFlowsParamsSchema,
        body: CreateOnboardingFlowSchema,
        response: { 201: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const { tenantId, projectId } = req.params as {
        tenantId: string;
        projectId: string;
      };
      const body = req.body as z.infer<typeof CreateOnboardingFlowSchema>;

      const projectService = new ProjectService(fastify.db);
      // Confirm the project actually belongs to this tenant before attaching a flow.
      await projectService.getById(tenantId, projectId);

      const onboardingService = new OnboardingService(fastify.db);
      const flow = await onboardingService.createFlow(projectId, body);

      void auditService
        .log({
          action: "TENANT_UPDATED",
          identityId: req.identity.id,
          tenantId,
          ip: req.ip,
          metadata: {
            event: "onboarding_flow_created",
            projectId,
            flowId: flow.id,
          },
        })
        .catch(() => {});

      return reply.status(201).send({ success: true, data: flow });
    },
  );

  fastify.get(
    "/:tenantId/projects/:projectId/onboarding-flows",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Onboarding Flows"],
        summary: "List onboarding flows for a project",
        security: [{ bearerAuth: [] }],
        params: ProjectFlowsParamsSchema,
        response: {
          200: z.object({ success: z.boolean(), data: z.array(z.any()) }),
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
      await projectService.getById(tenantId, projectId);

      const onboardingService = new OnboardingService(fastify.db);
      const flows = await onboardingService.listFlows(projectId);
      return reply.send({ success: true, data: flows });
    },
  );

  fastify.get(
    "/:tenantId/projects/:projectId/onboarding-flows/:flowId",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Onboarding Flows"],
        summary: "Get a single onboarding flow",
        security: [{ bearerAuth: [] }],
        params: OnboardingFlowParamsSchema,
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const { tenantId, projectId, flowId } = req.params as {
        tenantId: string;
        projectId: string;
        flowId: string;
      };

      const projectService = new ProjectService(fastify.db);
      await projectService.assertMembership(tenantId, req.identity.id);
      await projectService.getById(tenantId, projectId);

      const onboardingService = new OnboardingService(fastify.db);
      const flow = await onboardingService.getFlow(projectId, flowId);
      return reply.send({ success: true, data: flow });
    },
  );

  fastify.patch(
    "/:tenantId/projects/:projectId/onboarding-flows/:flowId",
    {
      preHandler: [
        fastify.auth.requireUser,
        fastify.auth.requirePermission("onboarding:manage"),
      ],
      schema: {
        tags: ["Onboarding Flows"],
        summary: "Update an onboarding flow",
        security: [{ bearerAuth: [] }],
        params: OnboardingFlowParamsSchema,
        body: UpdateOnboardingFlowSchema,
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const { tenantId, projectId, flowId } = req.params as {
        tenantId: string;
        projectId: string;
        flowId: string;
      };
      const body = req.body as z.infer<typeof UpdateOnboardingFlowSchema>;

      const projectService = new ProjectService(fastify.db);
      await projectService.getById(tenantId, projectId);

      const onboardingService = new OnboardingService(fastify.db);
      const flow = await onboardingService.updateFlow(projectId, flowId, body);
      return reply.send({ success: true, data: flow });
    },
  );

  fastify.delete(
    "/:tenantId/projects/:projectId/onboarding-flows/:flowId",
    {
      preHandler: [
        fastify.auth.requireUser,
        fastify.auth.requirePermission("onboarding:manage"),
      ],
      schema: {
        tags: ["Onboarding Flows"],
        summary:
          "Delete an onboarding flow (also deletes all progress records on it)",
        security: [{ bearerAuth: [] }],
        params: OnboardingFlowParamsSchema,
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const { tenantId, projectId, flowId } = req.params as {
        tenantId: string;
        projectId: string;
        flowId: string;
      };

      const projectService = new ProjectService(fastify.db);
      await projectService.getById(tenantId, projectId);

      const onboardingService = new OnboardingService(fastify.db);
      await onboardingService.deleteFlow(projectId, flowId);
      return reply.send({ success: true });
    },
  );
}

// ── End-user: progress tracking, mounted under /identity ────────────────────
export async function onboardingProgressRoute(fastify: FastifyInstance) {
  fastify.post(
    "/onboarding/start",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Onboarding Progress"],
        summary:
          "Start (or resume) onboarding progress for the current identity",
        security: [{ bearerAuth: [] }],
        body: StartProgressSchema,
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const { flowId } = req.body as z.infer<typeof StartProgressSchema>;
      const onboardingService = new OnboardingService(fastify.db);
      const progress = await onboardingService.startProgress(
        req.identity.id,
        flowId,
      );
      return reply.send({ success: true, data: progress });
    },
  );

  fastify.get(
    "/onboarding/:progressId",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Onboarding Progress"],
        summary: "Get the current identity's progress on a flow",
        security: [{ bearerAuth: [] }],
        params: ProgressParamsSchema,
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const { progressId } = req.params as { progressId: string };
      const onboardingService = new OnboardingService(fastify.db);
      const progress = await onboardingService.getProgress(
        req.identity.id,
        progressId,
      );
      return reply.send({ success: true, data: progress });
    },
  );

  fastify.post(
    "/onboarding/:progressId/advance",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Onboarding Progress"],
        summary:
          "Mark a step complete and advance the current identity's progress",
        security: [{ bearerAuth: [] }],
        params: ProgressParamsSchema,
        body: AdvanceProgressSchema,
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const { progressId } = req.params as { progressId: string };
      const body = req.body as z.infer<typeof AdvanceProgressSchema>;

      const onboardingService = new OnboardingService(fastify.db);
      const progress = await onboardingService.advanceProgress(
        req.identity.id,
        progressId,
        body,
      );
      return reply.send({ success: true, data: progress });
    },
  );
}
