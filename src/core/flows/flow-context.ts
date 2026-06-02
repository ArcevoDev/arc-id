import type { DbClient } from "@/lib/db-client";
import type { FlowLogger } from "@/lib/logger";

/**
 * Injected into every flow by FlowExecutor.
 * db is always the Prisma transaction client inside a run() call.
 * Never use the global prisma singleton inside a flow — always use ctx.db.
 */
export interface FlowContext {
  requestId: string;
  userId?: string;
  tenantId: string | null;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  db: DbClient;
  logger?: FlowLogger;
}
