"use client";

import { useState } from "react";
import {
  BillingPage,
  type BillingInterval,
  type BillingPageConfig,
  type BillingPlan,
} from "@arcevo/facet-components";
import { PLAN_CAPS } from "@/config/plan-caps";

const formatCap = (n: number) => (n === Infinity ? "Unlimited" : String(n));

export const pricingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "For individuals and small teams getting started.",
    features: [
      `${formatCap(PLAN_CAPS.FREE.tenants)} tenant${PLAN_CAPS.FREE.tenants === 1 ? "" : "s"}`,
      `${formatCap(PLAN_CAPS.FREE.members)} team members`,
      `${PLAN_CAPS.FREE.auditDays}-day audit log`,
      "OAuth2/OIDC provider",
      "TOTP MFA",
      "WebAuthn passkeys",
      "RBAC and tenant policies",
      "API keys",
    ],
    cta: { label: "Get Started", href: "/register" },
  },
  {
    id: "pro",
    name: "Pro",
    price: 99,
    description: "For growing teams with production workloads.",
    highlight: true,
    features: [
      `${formatCap(PLAN_CAPS.PRO.tenants)} tenants`,
      `${formatCap(PLAN_CAPS.PRO.members)} team members`,
      `${PLAN_CAPS.PRO.auditDays}-day audit log and export`,
      "Everything in Free",
      "Webhooks and event delivery",
      "SD-JWT verifiable credentials",
      "did:web and signing key management",
      "OAuth/OIDC client management",
    ],
    cta: { label: "Get Started", href: "/register" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organisations needing dedicated support and SLAs.",
    price: 0,
    features: [
      "Everything in Pro",
      "Unlimited tenants, members and identities",
      "Unlimited webhook deliveries",
      "365-day audit log and export",
      "On-prem deployment",
      "SAML and OIDC federation",
      "Custom SLAs",
      "Dedicated support engineer",
      "Custom integrations",
    ],
    customPriceLabel: "Contact",
    cta: {
      label: "Contact Sales",
      href: "mailto:sales@arcevo.com.ng",
      variant: "outline",
    },
  },
];

export function PricingContent() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  const billingConfig: BillingPageConfig = {
    plans: pricingPlans,
    interval,
    onIntervalChange: setInterval,
    title: "Simple, transparent pricing",
    description:
      "Sovereign identity infrastructure for teams of every size. Start for free, upgrade as you grow.",
    currency: "$",
    annualDiscountNote: "Save 20% with annual billing.",
    badge: (plan) => (plan.id === "pro" ? "Most Popular" : undefined),
    footer: (
      <p className="text-center text-sm text-muted-foreground">
        Questions? Contact{" "}
        <a
          href="mailto:hello@arcevo.com"
          className="underline"
        >
          hello@arcevo.com
        </a>
      </p>
    ),
  };

  return <BillingPage config={billingConfig} />;
}
