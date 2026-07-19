// src/modules/tenant/services/onboarding.service.ts
//
// NEW MODULE. Two responsibilities kept in one service since they're tightly
// coupled and small: (1) admins define OnboardingFlows on a Project,
// (2) identities progress through a flow over time.
//
// Progress advancement logic deliberately does NOT validate that `stepId`
// exists in flow.steps order strictly — it allows steps to be completed in
// any order the frontend presents them, since `required` (per-step) is a
// frontend rendering concern, not a backend gate. The backend's job is just
// to durably record what's been completed and what step the identity is
// currently on, plus arbitrary `data` collected along the way (e.g. answers
// to onboarding questions).

import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors";
import type {
  CreateOnboardingFlowInput,
  UpdateOnboardingFlowInput,
  AdvanceProgressInput,
} from "../validators/onboarding.schemas";
import { Prisma } from "@prisma-client";

export class OnboardingService {
  constructor(private readonly db: DbClient) {}

  // ── Flow management (admin-facing) ─────────────────────────────────────

  async createFlow(projectId: string, input: CreateOnboardingFlowInput) {
    return this.db.onboardingFlow.create({
      data: {
        projectId,
        name: input.name,
        steps: input.steps as Prisma.InputJsonValue,
        isActive: input.isActive,
      },
    });
  }

  async listFlows(projectId: string) {
    return this.db.onboardingFlow.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { progresses: true } } },
    });
  }

  async getFlow(projectId: string, flowId: string) {
    const flow = await this.db.onboardingFlow.findFirst({
      where: { id: flowId, projectId },
    });
    if (!flow) throw ApiError.notFound("Onboarding flow not found");
    return flow;
  }

  async updateFlow(
    projectId: string,
    flowId: string,
    input: UpdateOnboardingFlowInput,
  ) {
    const existing = await this.db.onboardingFlow.findFirst({
      where: { id: flowId, projectId },
      select: { id: true },
    });
    if (!existing) throw ApiError.notFound("Onboarding flow not found");

    return this.db.onboardingFlow.update({
      where: { id: flowId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.steps !== undefined
          ? { steps: input.steps as Prisma.InputJsonValue }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  async deleteFlow(projectId: string, flowId: string) {
    const existing = await this.db.onboardingFlow.findFirst({
      where: { id: flowId, projectId },
      select: { id: true },
    });
    if (!existing) throw ApiError.notFound("Onboarding flow not found");

    // Cascades to OnboardingProgress via the schema's onDelete: Cascade.
    await this.db.onboardingFlow.delete({ where: { id: flowId } });
  }

  // ── Progress tracking (end-user facing) ─────────────────────────────────

  /**
   * Starts (or returns existing) progress for an identity on a flow.
   * Idempotent — calling this twice for the same identity+flow returns the
   * same row rather than erroring, since "start onboarding" is a natural
   * thing for a frontend to call on every visit to the onboarding screen.
   */
  async startProgress(identityId: string, flowId: string) {
    const flow = await this.db.onboardingFlow.findUnique({
      where: { id: flowId },
      select: { id: true, isActive: true },
    });
    if (!flow) throw ApiError.notFound("Onboarding flow not found");
    if (!flow.isActive) {
      throw ApiError.badRequest("This onboarding flow is no longer active");
    }

    return this.db.onboardingProgress.upsert({
      where: { identityId_flowId: { identityId, flowId } },
      update: {}, // no-op if it already exists — just return current state
      create: {
        identityId,
        flowId,
        currentStep: 0,
        completedSteps: [],
        data: {},
      },
    });
  }

  async getProgress(identityId: string, progressId: string) {
    const progress = await this.db.onboardingProgress.findFirst({
      where: { id: progressId, identityId },
      include: {
        flow: { select: { name: true, steps: true, isActive: true } },
      },
    });
    if (!progress) throw ApiError.notFound("Onboarding progress not found");
    return progress;
  }

  /**
   * Marks a step complete, advances currentStep, and merges any collected
   * `data`. Setting completedAt happens when every step in flow.steps has
   * a matching id in completedSteps after this update.
   */
  async advanceProgress(
    identityId: string,
    progressId: string,
    input: AdvanceProgressInput,
  ) {
    const progress = await this.db.onboardingProgress.findFirst({
      where: { id: progressId, identityId },
      include: { flow: { select: { steps: true } } },
    });
    if (!progress) throw ApiError.notFound("Onboarding progress not found");

    const completedSteps = Array.isArray(progress.completedSteps)
      ? (progress.completedSteps as string[])
      : [];

    const updatedCompleted = completedSteps.includes(input.stepId)
      ? completedSteps
      : [...completedSteps, input.stepId];

    const mergedData = {
      ...(progress.data as Record<string, unknown>),
      ...(input.data ?? {}),
    };

    const flowSteps = (progress.flow.steps as Array<{ id: string }>) ?? [];
    const allStepIds = flowSteps.map((s) => s.id);
    const isComplete =
      allStepIds.length > 0 &&
      allStepIds.every((id) => updatedCompleted.includes(id));

    return this.db.onboardingProgress.update({
      where: { id: progressId },
      data: {
        completedSteps: updatedCompleted as Prisma.InputJsonValue,
        currentStep: updatedCompleted.length,
        data: mergedData as Prisma.InputJsonValue,
        ...(isComplete ? { completedAt: new Date() } : {}),
      },
    });
  }
}
