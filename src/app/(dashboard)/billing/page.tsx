"use client";

import { PageHeader } from "@arcevo/facet-layout";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@arcevo/facet-components";
import { useBilling, PLAN_STATUS_VARIANT } from "@/hooks/use-billing";

export default function BillingPage() {
  const { subscription, error, load } = useBilling();

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
