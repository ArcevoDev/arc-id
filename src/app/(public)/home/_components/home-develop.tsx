"use client";

import { Badge, CardContent, CardDescription, CardHeader, CardTitle, GlowCard, Icon } from "@arcevo/facet-components";

const benefits = [
  {
    title: "Passkey-first authentication",
    description:
      "Modern, phishing-resistant auth with WebAuthn passkeys as the default. No password database to steal.",
    icon: "lock",
  },
  {
    title: "Multi-tenant from day one",
    description:
      "Isolate identities, policies, and credentials per organisation. Each tenant gets its own OIDC issuer, branding, and RBAC rules.",
    icon: "users",
  },
  {
    title: "Verifiable credentials",
    description:
      "Issue and verify W3C Verifiable Credentials with SD-JWT selective disclosure. Let users prove who they are without oversharing data.",
    icon: "shield",
  },
  {
    title: "Global and sovereign",
    description:
      "Deploy anywhere - on-prem, in your cloud account, or at the edge. You own the data, the keys, and the identity layer.",
    icon: "globe",
  },
];

const standards = [
  "OAuth 2.0",
  "OpenID Connect",
  "WebAuthn",
  "TOTP / HOTP",
  "FIDO2",
  "W3C Verifiable Credentials",
  "did:web",
  "SD-JWT",
];

export function HomeDevelop() {
  return (
    <section id="benefits" className="py-20">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Built for developers who ship real products
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            ArcID handles the identity complexity so your team can focus on
            building. No vendor lock-in, no black-box SDKs - just standards you
            can read and trust.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <GlowCard key={b.title} className="border-0 bg-muted/30">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon name={b.icon} className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">{b.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{b.description}</CardDescription>
              </CardContent>
            </GlowCard>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Built on open standards
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {standards.map((s) => (
              <Badge key={s} variant="secondary">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
