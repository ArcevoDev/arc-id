// src/sdk/billing.sdk.ts
import { sdk } from "./client";

export const billingSdk = {
  getSubscription: () => sdk.get<any>("/api/v1/billing/subscription"),
  upgrade: (plan: string) => sdk.post<any>("/api/v1/billing/upgrade", { plan }),
};
