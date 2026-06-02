import type { DbClient } from "@/lib/db-client";

export class SubscriptionService {
  constructor(private db: DbClient) {}

  async getActive(identityId: string) {
    return this.db.subscription.findFirst({
      where: { identityId, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
    });
  }

  async upgrade(identityId: string, plan: "FREE" | "PRO" | "ENTERPRISE") {
    const existing = await this.getActive(identityId);
    if (existing) {
      await this.db.subscription.update({
        where: { id: existing.id },
        data: { status: "CANCELED", endsAt: new Date() },
      });
    }
    return this.db.subscription.create({
      data: { identityId, plan, status: "ACTIVE" },
    });
  }
}
