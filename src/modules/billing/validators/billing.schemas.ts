import { z } from "zod";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma-client";

// ─── Output DTOs ─────────────────────────────────────────────────────────────

export const SubscriptionDtoSchema = z.object({
  id: z.string().cuid(),
  plan: z.enum(SubscriptionPlan),
  status: z.enum(SubscriptionStatus),
  startedAt: z.coerce.string(),
  endsAt: z.coerce.string().nullable(),
});

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type SubscriptionDto = z.infer<typeof SubscriptionDtoSchema>;
