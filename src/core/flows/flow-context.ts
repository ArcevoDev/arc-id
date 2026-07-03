// src/core/flows/flow-context.ts
import type { DbClient } from "@/lib/db-client";
import type { FlowLogger } from "@/lib/logger";

/**
 * Injected into every flow by FlowExecutor.
 * db is always the Prisma transaction client inside a run() call.
 * Never use the global prisma singleton inside a flow — always use ctx.db.
 */
export interface FlowContext {
  requestId: string;
  identityId?: string;
  tenantId: string | null;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  db: DbClient;
  logger?: FlowLogger;
  // Caller's subscription plan — populated by routes that call requireUser/requirePlan.
  // Used by MembershipService.add() to enforce per-plan member caps.
  // Defaults to "FREE" in any flow that doesn't pass it.
  plan?: string;
}
