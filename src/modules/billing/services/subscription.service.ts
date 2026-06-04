import type { DbClient } from "@/lib/db-client";

export class SubscriptionService {
  constructor(private db: DbClient) {}

  async getActiveByTenant(tenantId: string) {
    return this.db.subscription.findUnique({
      where: { tenantId },
    });
  }

  async setPlan(tenantId: string, plan: "FREE" | "PRO" | "ENTERPRISE") {
    // Upsert single row for this tenant
    return this.db.subscription.upsert({
      where: { tenantId },
      update: { plan, status: "ACTIVE", updatedAt: new Date(), endsAt: null },
      create: { tenantId, plan, status: "ACTIVE" },
    });
  }

  async cancel(tenantId: string) {
    return this.db.subscription.update({
      where: { tenantId },
      data: { status: "CANCELED", endsAt: new Date(), updatedAt: new Date() },
    });
  }
}
