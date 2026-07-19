// src/modules/billing/services/subscription.service.ts
import type { DbClient } from "@/lib/db-client";
import type { SubscriptionPlan } from "@prisma-client";

export class SubscriptionService {
  constructor(private db: DbClient) {}

  async getForTenant(tenantId: string) {
    return this.db.subscription.findUnique({
      where: { tenantId },
      include: { billingIntegrations: true },
    });
  }

  async activateFromProvider(
    tenantId: string,
    plan: SubscriptionPlan,
    provider: string,
    externalCustomerId?: string | null,
    externalSubId?: string | null,
  ) {
    return (this.db as any).$transaction(async (tx: any) => {
      const subscription = await tx.subscription.upsert({
        where: { tenantId },
        update: { plan, status: "ACTIVE" },
        create: { tenantId, plan, status: "ACTIVE" },
      });

      if (provider && externalSubId) {
        await tx.externalBillingIntegration.upsert({
          where: {
            providerName_externalSubId: {
              providerName: provider,
              externalSubId,
            },
          },
          update: { externalCustomerId, metadata: { plan } },
          create: {
            subscriptionId: subscription.id,
            providerName: provider,
            externalCustomerId,
            externalSubId,
            metadata: { plan },
          },
        });
      }

      return subscription;
    });
  }

  async cancelFromProvider(tenantId: string) {
    return this.db.subscription.update({
      where: { tenantId },
      data: { plan: "FREE", status: "ACTIVE", endsAt: new Date() },
    });
  }
}
