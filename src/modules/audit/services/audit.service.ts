// src/modules/audit/services/audit.service.ts
import { AuditLogAction } from "@prisma-client";
import { prisma as globalDb } from "@/core/db";
import { logger } from "@/lib/logger";

export interface LogParams {
  action: AuditLogAction;
  identityId?: string;
  tenantId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  /** Request/correlation ID — passed through from FlowContext.requestId or FastifyRequest.id */
  requestId?: string;
}

export const auditService = {
  async log(params: LogParams, txClient?: any): Promise<void> {
    const client = txClient || globalDb;
    try {
      const meta = { ...(params.metadata || {}) };
      if (params.requestId) meta.requestId = params.requestId;

      await client.auditLog.create({
        data: {
          actionId: params.action,
          identityId: params.identityId,
          tenantId: params.tenantId,
          ip: params.ip,
          userAgent: params.userAgent,
          metadata: meta,
        },
      });
    } catch (error) {
      logger.error({ err: error }, "[AUDIT_LOG_UNHANDLED_EXCEPTION_FAULT]");
    }
  },
};
