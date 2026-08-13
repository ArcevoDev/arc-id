"use client";

import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Icon, Marquee } from "@arcevo/facet-components";

const FEATURES = [
  {
    title: "Passkey-native auth",
    description: "WebAuthn passkeys, TOTP MFA, and magic links — phishing-resistant sign-in out of the box.",
    icon: "key-round" as const,
  },
  {
    title: "OAuth2 / OIDC provider",
    description: "Full authorization code + PKCE, JWKS, token introspection, and refresh rotation.",
    icon: "shield-check" as const,
  },
  {
    title: "Verifiable Credentials",
    description: "SD-JWT issuance, revocation, and presentation with W3C Bitstring Status Lists.",
    icon: "file-check" as const,
  },
  {
    title: "Multi-tenant by design",
    description: "Tenant policies, RBAC, signing keys, and per-tenant projects from day one.",
    icon: "building" as const,
  },
  {
    title: "Webhook delivery",
    description: "Reliable event delivery with retries, backoff, HMAC signing, and dead-lettering.",
    icon: "send" as const,
  },
  {
    title: "Audit + observability",
    description: "Every security action audit-logged, correlated, and exported as Prometheus metrics.",
    icon: "activity" as const,
  },
];

const SECTORS = [
  { name: "Academic", icon: "graduation-cap" as const },
  { name: "Financial Services", icon: "credit-card" as const },
  { name: "Healthcare", icon: "heart-pulse" as const },
  { name: "Government", icon: "landmark" as const },
  { name: "Telecom", icon: "smartphone" as const },
  { name: "Enterprise", icon: "briefcase" as const },
];

export default function LandingPage() {
  return (
    <div className="space-y-20 py-16">
      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-foreground">Built for the identity stack</h2>
          <p className="text-muted-foreground">Everything a modern IAM needs, without the lock-in.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <Icon name={f.icon} className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">{f.title}</CardTitle>
                <CardDescription>{f.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Sectors */}
      <section id="sectors" className="mx-auto max-w-6xl px-6 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-foreground">Sector-agnostic by design</h2>
          <p className="text-muted-foreground">
            One canonical identity that verifies across every sector you operate in.
          </p>
        </div>
        <Marquee items={SECTORS.map((s) => (
          <Card key={s.name} className="w-56 shrink-0">
            <CardContent className="flex flex-col items-center gap-3 py-8">
              <Icon name={s.icon} className="h-8 w-8 text-primary" />
              <span className="font-medium text-foreground">{s.name}</span>
            </CardContent>
          </Card>
        ))} />
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6">
        <Card className="text-center py-12">
          <CardContent className="space-y-6">
            <h2 className="text-3xl font-bold text-foreground">
              Ready to put identity back in the holder&apos;s hands?
            </h2>
            <p className="text-muted-foreground">
              Spin up a tenant, issue your first credential, and integrate the SDK — all today.
            </p>
            <Button size="lg" asChild>
              <Link href="/register">Create your account</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
