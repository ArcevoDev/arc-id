"use client";

import { useState } from "react";
import {
  Badge,
  BillingPage,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type BillingInterval,
  type BillingPageConfig,
  type BillingPlan,
} from "@arcevo/facet-components";
import { PageShell } from "@/components/page-shell";
import { useBilling } from "@/hooks/use-billing";
import { PLAN_CAPS, planLabel } from "@/config/plan-caps";
import type { Subscription as SdkSubscription } from "@arcevo/facet-sdk";

interface Subscription extends SdkSubscription {
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

const formatCap = (n: number) => (n === Infinity ? "Unlimited" : String(n));

const pricingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "For solo developers and small teams.",
    features: [
      `${formatCap(PLAN_CAPS.FREE.tenants)} tenant${PLAN_CAPS.FREE.tenants === 1 ? "" : "s"}`,
      `${formatCap(PLAN_CAPS.FREE.members)} team members`,
      `${PLAN_CAPS.FREE.auditDays}-day audit log`,
      "OAuth2/OIDC provider",
      "TOTP MFA",
      "WebAuthn passkeys",
      "RBAC & tenant policies",
      "API keys",
    ],
    cta: { label: "Current", href: "#", variant: "outline" },
  },
  {
    id: "pro",
    name: "Pro",
    price: 99,
    description: "For businesses with advanced identity needs.",
    highlight: true,
    features: [
      `${formatCap(PLAN_CAPS.PRO.tenants)} tenants`,
      `${formatCap(PLAN_CAPS.PRO.members)} team members`,
      `${PLAN_CAPS.PRO.auditDays}-day audit log & export`,
      "Everything in Free",
      "Webhooks & event delivery",
      "SD-JWT verifiable credentials",
      "did:web & signing key management",
      "OAuth/OIDC client management",
    ],
    cta: { label: "Get Started", href: "#" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations and custom deployments.",
    price: 0,
    features: [
      "Everything in Pro",
      "Unlimited tenants, members & identities",
      "Unlimited webhook deliveries",
      "365-day audit log & export",
      "On-prem deployment",
      "SAML & OIDC federation",
      "Custom SLAs",
      "Dedicated support engineer",
      "Custom integrations",
    ],
    customPriceLabel: "Contact",
    cta: {
      label: "Contact Sales",
      href: "mailto:hello@arcevo.com",
      variant: "outline",
    },
  },
];

export default function BillingPageComponent() {
  const { subscription, error: billingError } = useBilling();
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const loading = !subscription && !billingError;
  const sub = subscription as Subscription | null;
  const currentPlan = sub?.plan?.toLowerCase();

  if (loading) {
    return (
      <PageShell
        title="Billing"
        description="Manage your subscription and billing."
        card={false}
      >
        <p className="text-muted-foreground">Loading billing details…</p>
      </PageShell>
    );
  }

  if (billingError) {
    return (
      <PageShell
        title="Billing"
        description="Manage your subscription and billing."
        card={false}
      >
        <p className="text-sm text-destructive">{billingError}</p>
      </PageShell>
    );
  }

  const billingConfig: BillingPageConfig = {
    plans: pricingPlans,
    interval,
    onIntervalChange: setInterval,
    title: "ArcID Pricing",
    description: "Sovereign identity infrastructure for teams of every size.",
    currency: "$",
    annualDiscountNote: "Save 2 months with annual billing.",
    header: sub ? (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Current Subscription
            <Badge variant="outline">{planLabel(sub.plan)}</Badge>
          </CardTitle>
          <CardDescription>Status: {sub.status ?? "Unknown"}</CardDescription>
        </CardHeader>
        <CardContent>
          {sub.status === "ACTIVE" &&
            (sub.cancelAtPeriodEnd ? (
              <p className="text-sm text-amber-500">
                Cancellation scheduled at period end.
              </p>
            ) : sub.currentPeriodEnd ? (
              <p className="text-sm text-muted-foreground">
                Renews on{" "}
                {new Date(sub.currentPeriodEnd).toLocaleDateString()}
              </p>
            ) : null)}
          <Button variant="outline" size="sm" className="mt-4">
            Manage Billing
          </Button>
        </CardContent>
      </Card>
    ) : null,
    badge: (plan) => (plan.id === currentPlan ? "Current" : undefined),
    footer: (
      <p className="text-center text-sm text-muted-foreground">
        Questions? Contact{" "}
        <a href="mailto:hello@arcevo.com" className="underline">
          hello@arcevo.com
        </a>
      </p>
    ),
  };

  return (
    <PageShell
      title="Billing"
      description="Choose a plan and manage your subscription."
      card={false}
    >
      <BillingPage config={billingConfig} />
    </PageShell>
  );
}
