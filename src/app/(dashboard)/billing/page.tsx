// src/app/(dashboard)/billing/page.tsx
"use client";
import { useEffect, useState } from "react";
import { billingSdk } from "@/sdk/billing.sdk";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const PLANS = [
  {
    id: "FREE",
    name: "Free",
    price: "₦0 / mo",
    features: [
      "1 tenant",
      "Basic audit logs",
      "Email auth",
      "TOTP MFA",
      "Passkeys",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: "₦25,000 / mo",
    features: [
      "Unlimited OAuth clients",
      "5 tenants",
      "Full audit history",
      "did:web issuance",
      "VC issuance",
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: "Custom",
    features: [
      "Unlimited everything",
      "SSO / SAML2 / OIDC federation",
      "SCIM provisioning",
      "HSM signing keys",
      "SLA + priority support",
      "Custom domain",
    ],
  },
];

export default function BillingPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [portalOpen, setPortalOpen] = useState(false);
  const [targetPlan, setTargetPlan] = useState<string | null>(null);

  useEffect(() => {
    billingSdk
      .getSubscription()
      .then((data) => setSubscription(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentPlan = subscription?.plan ?? "FREE";
  const status = subscription?.status ?? "ACTIVE";

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Billing"
        description="Manage your plan and subscription."
      />

      {/* Current plan */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Current plan</CardTitle>
            <StatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-3xl font-bold text-foreground">
                {currentPlan}
              </p>
              {subscription?.expiresAt && (
                <p className="text-xs text-muted-foreground">
                  Renews {new Date(subscription.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isUpgrade =
            ["FREE", "PRO", "ENTERPRISE"].indexOf(plan.id) >
            ["FREE", "PRO", "ENTERPRISE"].indexOf(currentPlan);
          return (
            <Card
              key={plan.id}
              className={`bg-card border-border relative ${isCurrent ? "border-primary/40 ring-1 ring-primary/20" : ""}`}
            >
              {isCurrent && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <Badge className="text-[10px] bg-primary text-primary-foreground">
                    Current
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{plan.name}</CardTitle>
                <p className="text-xl font-bold text-foreground mt-1">
                  {plan.price}
                </p>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4 space-y-4">
                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <Icons.check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && isUpgrade && (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setTargetPlan(plan.id);
                      setPortalOpen(true);
                    }}
                  >
                    Upgrade to {plan.name}
                  </Button>
                )}
                {!isCurrent && !isUpgrade && (
                  <p className="text-xs text-muted-foreground text-center">
                    Contact support to downgrade
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={portalOpen} onOpenChange={setPortalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to {targetPlan}</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Plan changes are managed through your payment provider. You'll be
            redirected to complete the upgrade via the billing portal.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPortalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setPortalOpen(false)}>
              Go to billing portal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
