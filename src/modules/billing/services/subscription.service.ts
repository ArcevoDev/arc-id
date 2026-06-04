// src/modules/billing/services/subscription.service.ts
// The Subscription model is TENANT-scoped (tenantId @unique), not identity-scoped.
// Each tenant has exactly one Subscription row.
// Provider data goes into the ExternalBillingIntegration child table.
import type { DbClient } from "@/lib/db-client";
import type { SubscriptionPlan } from "@/prisma-client";

export class SubscriptionService {
  constructor(private db: DbClient) {}

  async getForTenant(tenantId: string) {
    return this.db.subscription.findUnique({
      where: { tenantId },
      include: { billingIntegrations: true },
    });
  }

  /**
   * Upgrade (or downgrade) a tenant's plan.
   * Creates the Subscription record if it doesn't exist yet.
   */
  async upgrade(tenantId: string, plan: SubscriptionPlan) {
    return this.db.subscription.upsert({
      where: { tenantId },
      update: { plan, status: "ACTIVE" },
      create: { tenantId, plan, status: "ACTIVE" },
    });
  }

  /**
   * Activate a plan from a billing provider webhook.
   * Creates/updates the Subscription and upserts the ExternalBillingIntegration row.
   */
  async activateFromProvider(
    tenantId: string,
    plan: SubscriptionPlan,
    provider: string,
    externalCustomerId?: string | null,
    externalSubId?: string | null,
  ) {
    return this.db.$transaction(async (tx) => {
      const subscription = await tx.subscription.upsert({
        where: { tenantId },
        update: { plan, status: "ACTIVE" },
        create: { tenantId, plan, status: "ACTIVE" },
      });

      if (provider && externalSubId) {
        await tx.externalBillingIntegration.upsert({
          where: { providerName_externalSubId: { providerName: provider, externalSubId } },
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

  /**
   * Cancel (downgrade to FREE) after a provider webhook signals non-renewal.
   */
  async cancelFromProvider(tenantId: string) {
    return this.db.subscription.update({
      where: { tenantId },
      data: { plan: "FREE", status: "ACTIVE", endsAt: new Date() },
    });
  }
}