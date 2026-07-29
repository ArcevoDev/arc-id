"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Subscription & plan management" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Free", "Pro", "Enterprise"].map((plan) => (
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
              <Button className="w-full" variant={plan === "Pro" ? "default" : "outline"}>
                {plan === "Free" ? "Current" : "Upgrade"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
