"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@arcevo/facet-components";
import { useAuthStore } from "@/store/auth.store";
import { billing } from "@/sdk";
import type { Subscription } from "@arcevo/facet-sdk";

const PLAN_STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive"> = {
  ACTIVE: "success",
  TRIAL: "default",
  PAST_DUE: "warning",
  CANCELED: "destructive",
};

export default function BillingPage() {
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
      <PageHeader
        title="Billing"
        description="Subscription & plan management"
        actions={
          <Button variant="secondary" size="sm" onClick={load}>
            Refresh
          </Button>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}

      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-semibold">{subscription.plan}</span>
              <Badge variant={PLAN_STATUS_VARIANT[subscription.status] ?? "default"}>
                {subscription.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Tenant {subscription.tenantId.slice(0, 12)}…
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Free", "Pro", "Enterprise"].map((plan) => {
          const isCurrent = subscription?.plan === plan;
          return (
            <Card key={plan}>
              <CardHeader>
                <CardTitle>{plan}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {plan === "Free" && "Basic identity features"}
                  {plan === "Pro" && "Advanced security & credentials"}
                  {plan === "Enterprise" && "Full platform access"}
                </p>
                <Button
                  className="w-full"
                  variant={isCurrent ? "default" : "outline"}
                  disabled={isCurrent}
                >
                  {isCurrent ? "Current" : "Upgrade"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
