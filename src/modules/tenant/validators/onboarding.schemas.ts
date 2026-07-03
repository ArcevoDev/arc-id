// src/modules/tenant/validators/onboarding.schemas.ts
//
// NEW MODULE. OnboardingFlow and OnboardingProgress existed in the Prisma
// schema with zero routes/services/flows anywhere in the codebase.
//
// An OnboardingFlow belongs to a Project (e.g. "ArcWallet new-user setup").
// `steps` is an ordered JSON array — each step is a free-form descriptor the
// consuming frontend renders (the backend doesn't interpret step content,
// only tracks position). OnboardingProgress tracks one Identity's position
// through one Flow.

import { z } from "zod";

// A single step descriptor. Intentionally loose — the frontend defines what
// a step looks like (form, info screen, action, etc); the backend only needs
// an id to track position against.
export const OnboardingStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.string().optional(), // e.g. "form" | "info" | "action" — frontend-defined
  required: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const CreateOnboardingFlowSchema = z.object({
  name: z.string().min(1).max(100),
  steps: z.array(OnboardingStepSchema).min(1),
  isActive: z.boolean().default(true),
});

export const UpdateOnboardingFlowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  steps: z.array(OnboardingStepSchema).min(1).optional(),
  isActive: z.boolean().optional(),
});

export const OnboardingFlowParamsSchema = z.object({
  tenantId: z.string().cuid(),
  projectId: z.string().cuid(),
  flowId: z.string().cuid(),
});

export const ProjectFlowsParamsSchema = z.object({
  tenantId: z.string().cuid(),
  projectId: z.string().cuid(),
});

// ── Progress tracking — called by the identity going through the flow ───────

export const StartProgressSchema = z.object({
  flowId: z.string().cuid(),
});

export const AdvanceProgressSchema = z.object({
  stepId: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const ProgressParamsSchema = z.object({
  progressId: z.string().cuid(),
});

export type CreateOnboardingFlowInput = z.infer<
  typeof CreateOnboardingFlowSchema
>;
export type UpdateOnboardingFlowInput = z.infer<
  typeof UpdateOnboardingFlowSchema
>;
export type AdvanceProgressInput = z.infer<typeof AdvanceProgressSchema>;
