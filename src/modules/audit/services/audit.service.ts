import { db } from "@/lib/db-client";
import type { AuditLogAction, Prisma } from "@/prisma-client";
import { logger } from "@/lib/logger";

interface LogParams {
  action: AuditLogAction;
  identityId?: string;
  tenantId?: string;
  ip?: string;
  metadata?: Prisma.InputJsonValue;
}

export const auditService = {
  async log(params: LogParams): Promise<void> {
    try {
      await db.auditLog.create({
        data: {
          actionId: params.action,
          identityId: params.identityId,
          tenantId: params.tenantId,
          ip: params.ip,
          metadata: params.metadata,
        },
      });
    } catch (err: any) {
      logger.error("[AUDIT_LOG_FAILED]", { error: err.message, params });
    }
  },
};
