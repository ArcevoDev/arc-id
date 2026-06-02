import type { AuditLog } from "@/prisma-client";

export function presentAuditLog(log: AuditLog) {
  return {
    id: log.id,
    action: log.actionId,
    identityId: log.identityId,
    tenantId: log.tenantId,
    ip: log.ip,
    metadata: log.metadata,
    createdAt: log.createdAt,
  };
}
