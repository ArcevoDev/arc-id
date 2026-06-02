import { z } from "zod";
import { SubscriptionPlan, SubscriptionStatus } from "@/prisma-client";

// ─── Input Schemas ──────────────────────────────────────────────────────────

export const UpgradePlanSchema = z.object({
  /**
   * Target subscription tier.
   * Sourced from DB enum so adding a new plan only requires a schema migration —
   * no validator touch needed.
   */
  plan: z.nativeEnum(SubscriptionPlan),
});

// ─── Output DTOs ─────────────────────────────────────────────────────────────

export const SubscriptionDtoSchema = z.object({
  id: z.string().cuid(),
  plan: z.nativeEnum(SubscriptionPlan),
  status: z.nativeEnum(SubscriptionStatus),
  startedAt: z.coerce.string(),
  endsAt: z.coerce.string().nullable(),
});

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type UpgradePlanInput = z.infer<typeof UpgradePlanSchema>;
export type SubscriptionDto = z.infer<typeof SubscriptionDtoSchema>;
