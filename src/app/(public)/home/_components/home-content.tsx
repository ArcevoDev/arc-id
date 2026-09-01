"use client";

import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  GlowCard,
  Icon,
  type IconProps,
} from "@arcevo/facet-components";
import { HomeFeatures } from "./home-features";
import { HomeDevelop } from "./home-develop";
import { HomeStats } from "./home-stats";

const steps = [
  {
    title: "Deploy",
    description:
      "Run ArcID in 30 seconds with Docker Compose. Postgres 17 + Redis 7 + API + workers — ready for production with auto-migration and health checks.",
    icon: "package",
  },
  {
    title: "Configure",
    description:
      "Create your first tenant, configure your OIDC issuer, set up branding and RBAC policies, and enable passkeys or TOTP MFA.",
    icon: "settings",
  },
  {
    title: "Integrate",
    description:
      "Drop in the ArcID SDK, add passkey login, and start issuing verifiable credentials — all with standards you control.",
    icon: "code",
  },
];

const securityFeatures = [
  {
    title: "PKIX path validation",
    description:
      "OIDC discovery URLs and token endpoints are validated against private IP ranges and cloud metadata endpoints — SSRF blocked at the edge.",
    icon: "shield-check",
  },
  {
    title: "Distributed revocation",
    description:
      "Access tokens are revoked across Redis (hot path) and the database (fallback) — a logout on one device kills the session everywhere.",
    icon: "activity",
  },
  {
    title: "Zero-trust tenant isolation",
    description:
      "Every query is scoped to tenantId from the authenticated context. TenantId is never trusted from request bodies — validated against membership.",
    icon: "lock",
  },
  {
    title: "Passkey-first by default",
    description:
      "FIDO2 security keys and platform authenticators are the primary auth factor. No password database to steal.",
    icon: "fingerprint",
  },
];

const faqs = [
  {
    question: "Is ArcID open source?",
    answer:
      "ArcID is self-hostable and built from open standards. The backend is written in TypeScript (Fastify + Prisma) and the frontend uses Next.js 16.",
  },
  {
    question: "What standards does ArcID support?",
    answer:
      "OAuth 2.0, OpenID Connect, WebAuthn/FIDO2, TOTP/HOTP, W3C Verifiable Credentials with SD-JWT, did:web, and SAML 2.0 federation.",
  },
  {
    question: "Can I run ArcID on-prem?",
    answer:
      "Yes. A multi-stage Dockerfile and docker-compose.yml (Postgres 17 + Redis 7) are included. Run `docker compose up -d` and you're live.",
  },
  {
    question: "How do I migrate from my current IdP?",
    answer:
      "ArcID supports OIDC and SAML federation, so you can connect your existing IdP and migrate users gradually. Contact us for migration assistance.",
  },
];

export function HomeContent() {
  return (
    <>
      <HomeFeatures />
      <HomeDevelop />

      {/* ── How it works ───────────────────────────────────────── */}
      <section id="how-it-works" className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-center text-3xl font-bold text-foreground mb-4">
            Get started in three steps
          </h2>
          <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
            Deploy, configure, and integrate — ArcID handles the identity
            infrastructure so you don't have to.
          </p>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {steps.map((step) => (
              <GlowCard
                key={step.title}
                className="flex flex-col overflow-hidden"
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon
                        name={step.icon as IconProps["name"]}
                        className="h-6 w-6 text-primary"
                      />
                    </div>
                    <CardTitle>{step.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <CardDescription className="break-words">
                    {step.description}
                  </CardDescription>
                </CardContent>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security model ────────────────────────────────────── */}
      <section
        id="security"
        className="border-t py-24 bg-muted/30 dark:bg-muted/50"
      >
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <Badge variant="outline">Security-first</Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">
              Defence in depth, from the network up
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              ArcID is built with security as the default. Every outbound
              request is validated, every token revocation is durable, and
              every query is tenant-scoped at the database layer.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {securityFeatures.map((feature) => (
              <GlowCard
                key={feature.title}
                className="flex flex-col overflow-hidden border-0 bg-transparent"
              >
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Icon
                      name={feature.icon as IconProps["name"]}
                      className="h-6 w-6 text-primary"
                    />
                  </div>
                  <CardTitle className="text-lg">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="break-words">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section id="faq" className="py-24">
        <div className="container mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-bold text-foreground mb-4">
            Frequently asked questions
          </h2>
          <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
            Everything you need to know about getting started with ArcID.
          </p>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <Card key={faq.question}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {faq.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="break-words">
                    {faq.answer}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Still have questions?{" "}
              <Link href="/feedback" className="underline">
                Send us feedback
              </Link>
              .
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Button asChild>
                <Link href="/register">Get Started</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="https://docs.arcevo.id">Read Documentation</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <HomeStats />
    </>
  );
}
