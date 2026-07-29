import type { SdkClient } from "./client";

export function createBillingSdk(client: SdkClient) {
  return {
    /**
     * GET /billing/subscription — returns the active subscription for the
     * authenticated user's tenant, or a default FREE-plan object.
     *
     * Self-service plan changes (upgrade/downgrade) were intentionally removed.
     * All plan changes go through the payment-provider webhook path
     * (Paystack/Stripe). Direct upgrade/subscription/upgrade returns 410 Gone.
     */
    getSubscription: () => client.get<any>("/billing/subscription"),
  };
}
