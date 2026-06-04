"use client";
import { useEffect, useState } from "react";
import { billing } from "@/lib/api";
import { Button, Badge, Card, CardBody, CardHeader, CardFooter, Alert, Spinner } from "@/components/ui";

const PLANS = [
  {
    id: "FREE", name: "Free", price: "₦0 / mo",
    features: ["Core OIDC/OAuth", "Up to 100 identities", "Passkey auth", "Basic credentials"],
    highlight: false,
  },
  {
    id: "PRO", name: "Pro", price: "₦25,000 / mo",
    features: ["Everything in Free", "Unlimited identities", "Multi-tenant isolation", "Advanced VC issuance", "Webhook support", "Priority support"],
    highlight: true,
  },
  {
    id: "ENTERPRISE", name: "Enterprise", price: "Custom",
    features: ["Everything in Pro", "Custom SSO/SAML", "SCIM provisioning", "SLA guarantees", "Dedicated support", "On-premise deployment"],
    highlight: false,
  },
];

export default function BillingPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    billing.getSubscription()
      .then(r => setSubscription(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(plan: string) {
    setUpgrading(plan); setError(""); setSuccess("");
    try {
      const res = await billing.upgradePlan(plan as any);
      setSubscription(res.data);
      setSuccess(`Plan updated to ${plan}!`);
    } catch (e: any) { setError(e.message); }
    finally { setUpgrading(""); }
  }

  const currentPlan = subscription?.plan ?? "FREE";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Billing & Subscription</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your ArcID subscription plan</p>
      </div>

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {subscription && (
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">Current plan</p>
              <p className="text-xl font-bold text-zinc-900 mt-0.5">{subscription.plan}</p>
              <p className="text-xs text-zinc-400 mt-1">Status: {subscription.status}</p>
            </div>
            <Badge variant={subscription.plan === "PRO" ? "info" : subscription.plan === "ENTERPRISE" ? "success" : "default"}>
              {subscription.plan}
            </Badge>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map(plan => (
          <Card key={plan.id} className={`${plan.highlight ? "ring-2 ring-zinc-900" : ""}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-zinc-900">{plan.name}</h3>
                {plan.highlight && <Badge>Popular</Badge>}
              </div>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{plan.price}</p>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="text-sm text-zinc-600 flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span> {f}
                  </li>
                ))}
              </ul>
            </CardBody>
            <CardFooter>
              {currentPlan === plan.id ? (
                <Button variant="secondary" className="w-full" disabled>Current plan</Button>
              ) : plan.id === "ENTERPRISE" ? (
                <Button variant="secondary" className="w-full" onClick={() => alert("Contact sales@arcid.io")}>Contact sales</Button>
              ) : (
                <Button className="w-full" loading={upgrading === plan.id} onClick={() => handleUpgrade(plan.id)}>
                  {currentPlan === "FREE" && plan.id === "PRO" ? "Upgrade" : "Switch plan"}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
