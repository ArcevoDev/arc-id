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
}

export const auditService = {
  async log(params: LogParams, txClient?: any): Promise<void> {
    const client = txClient || globalDb;
    try {
      await client.auditLog.create({
        data: {
          actionId: params.action,
          identityId: params.identityId,
          tenantId: params.tenantId,
          ip: params.ip,
          userAgent: params.userAgent,
          metadata: params.metadata || {},
        },
      });
    } catch (error) {
      logger.error({ err: error }, "[AUDIT_LOG_UNHANDLED_EXCEPTION_FAULT]");
    }
  },
};
