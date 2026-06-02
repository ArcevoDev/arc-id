import type { DbClient } from "@/lib/db-client";

export class AuditRepository {
  constructor(private db: DbClient) {}

  async query(params: {
    identityId?: string;
    tenantId?: string;
    from?: Date;
    to?: Date;
    page: number;
    limit: number;
  }) {
    const where: any = {};
    if (params.identityId) where.identityId = params.identityId;
    if (params.tenantId) where.tenantId = params.tenantId;
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = params.from;
      if (params.to) where.createdAt.lte = params.to;
    }

    const [logs, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.db.auditLog.count({ where }),
    ]);

    return { logs, total, page: params.page, limit: params.limit };
  }
}
