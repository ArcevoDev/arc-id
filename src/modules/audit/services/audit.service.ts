// src/modules/audit/services/audit.service.ts
import { AuditLogAction } from "@/prisma-client";
import { db as globalDb } from "@/lib/db-client";

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
    // If a transactional Prisma client context was passed down, use it; otherwise fallback to standard pool
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
      // Prevent telemetry logging engine crashes from breaking the main auth execution loop
      console.error("[AUDIT_LOG_UNHANDLED_EXCEPTION_FAULT]:", error);
    }
  },
};