"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { billing } from "@/sdk";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@arcevo/facet-components";
import type { Subscription } from "@arcevo/facet-sdk";

const PLAN_STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive"> = {
  ACTIVE: "success",
  TRIAL: "default",
  PAST_DUE: "warning",
  CANCELED: "destructive",
};

export default function OrganizationBillingPage() {
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

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {subscription ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current subscription</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <span className="text-2xl font-semibold">{subscription.plan}</span>
            <Badge variant={PLAN_STATUS_VARIANT[subscription.status] ?? "default"}>
              {subscription.status}
            </Badge>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">No subscription loaded.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
