"use client";

import { CardContent, CardDescription, CardHeader, CardTitle, GlowCard, Icon, type IconProps } from "@arcevo/facet-components";

const features = [
  {
    title: "OIDC Provider",
    description:
      "Full OAuth2/OIDC provider with mandatory PKCE, refresh tokens, consent flows, and token introspection.",
    icon: "globe",
  },
  {
    title: "WebAuthn Passkeys",
    description:
      "Passwordless authentication via FIDO2 security keys and platform authenticators.",
    icon: "fingerprint-pattern",
  },
  {
    title: "TOTP MFA",
    description:
      "Time-based one-time passwords with QR codes and recovery codes for step-up auth.",
    icon: "key-round",
  },
  {
    title: "SD-JWT Verifiable Credentials",
    description:
      "Issue, verify, and revoke W3C credentials with SD-JWT for selective disclosure.",
    icon: "badge-check",
  },
  {
    title: "did:web",
    description:
      "Host decentralized identifiers on your own domain for verifiable trust anchored on HTTPS.",
    icon: "code",
  },
  {
    title: "Multi-Tenant RBAC",
    description:
      "Fine-grained role-based access control with tenant isolation and policy enforcement.",
    icon: "users",
  },
];

export function HomeFeatures() {
  return (
    <section id="features" className="py-24">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-3xl font-bold text-foreground mb-4">
          Everything you need for identity
        </h2>
        <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
          One platform. Full-stack identity primitives for building
          sovereign, verifiable, and trustworthy applications.
        </p>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <GlowCard key={feature.title} className="flex flex-col overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon
                      name={feature.icon as IconProps["name"]}
                      className="h-6 w-6 text-primary"
                    />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription className="break-words">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  );
}
