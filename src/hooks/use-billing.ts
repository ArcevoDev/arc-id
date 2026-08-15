"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { billing } from "@/sdk";
import type { Subscription } from "@arcevo/facet-sdk";

export const PLAN_STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive"> = {
  ACTIVE: "success",
  TRIAL: "default",
  PAST_DUE: "warning",
  CANCELED: "destructive",
};

export function useBilling() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const result = await billing.getSubscription();
    if (result.data) setSubscription(result.data);
    else setError(result.error?.message ?? "Failed to load subscription");
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  return { subscription, error, load };
}
