/**
 * Centralized per-plan capability caps.
 *
 * Enforced at runtime in flows/services - not persisted in the Prisma
 * schema - so limits can be adjusted per tenant or over time without a
 * migration.  The backend is the real enforcement boundary; the billing
 * UI imports this same file so the two never drift.
 */

/**
 * Caps enforced per subscription plan.
 *
 * - tenants: max tenants an identity can create or be a member of (system-wide)
 * - members: max active+pending members in a single tenant
 * - auditDays: audit-log retention window (informational / data-retention)
 */
export interface PlanCaps {
  tenants: number;
  members: number;
  auditDays: number;
}

export const PLAN_CAPS: Record<string, PlanCaps> = {
  FREE: { tenants: 1, members: 3, auditDays: 14 },
  PRO: { tenants: 5, members: 50, auditDays: 90 },
  ENTERPRISE: { tenants: Infinity, members: Infinity, auditDays: 365 },
};

/**
 * Resolve caps for a plan name (defaults to FREE).
 * The plan string comes from `ctx.plan` / `Subscription.plan`
 * which mirrors the Prisma `SubscriptionPlan` enum values.
 */
export function getPlanCaps(plan?: string): PlanCaps {
  return PLAN_CAPS[plan ?? "FREE"] ?? PLAN_CAPS.FREE;
}

/** Human-readable plan label, falls back to "Free". */
export function planLabel(plan?: string): string {
  const map: Record<string, string> = {
    FREE: "Free",
    PRO: "Pro",
    ENTERPRISE: "Enterprise",
  };
  return map[plan ?? "FREE"] ?? "Free";
}
