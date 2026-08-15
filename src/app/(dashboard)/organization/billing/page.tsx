"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@arcevo/facet-components";
import { useBilling, PLAN_STATUS_VARIANT } from "@/hooks/use-billing";

export default function OrganizationBillingPage() {
  const { subscription, error } = useBilling();

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
