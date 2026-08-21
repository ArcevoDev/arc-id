"use client";

import { PageHeader } from "@arcevo/facet-layout";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@arcevo/facet-components";
import { useBilling } from "@/hooks/use-billing";
import type { Subscription as SdkSubscription } from "@arcevo/facet-sdk";

interface Subscription extends SdkSubscription {
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export default function BillingPage() {
  const { subscription, error } = useBilling();
  const loading = !subscription && !error;
  const sub = subscription as Subscription | null;

  return (
    <>
      <PageHeader title="Billing" description="Subscription and payment details." />
      <main className="p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>
              {loading ? "Loading..." : sub?.plan ?? "Unknown"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!loading && sub && (
              <>
                <p>
                  <span className="font-medium">Status: </span>
                  <span className={sub.status === "ACTIVE" ? "text-green-500" : "text-muted-foreground"}>
                    {sub.status}
                  </span>
                </p>
                {sub.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground">
                    Renews on {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
                {sub.cancelAtPeriodEnd && (
                  <p className="text-sm text-amber-500">
                    Cancellation scheduled at period end.
                  </p>
                )}
              </>
            )}
            <Button variant="outline" size="sm">
              Manage Billing
            </Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
