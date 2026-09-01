"use client";

import Link from "next/link";
import { AnimatedButton, Badge, Button, GradientText } from "@arcevo/facet-components";

export function HomeHero() {
  return (
    <div className="text-center">
      <Badge variant="outline" className="mb-6">
        Sovereign identity for the decentralized web
      </Badge>

      <h1 className="text-5xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
        <GradientText text="Own your identity. Verify anything. Trust nothing." />
      </h1>

      <p className="text-muted-foreground mx-auto mt-8 max-w-2xl text-lg">
        ArcID is a sovereign multi-tenant IAM backend providing OIDC,
        WebAuthn passkeys, TOTP MFA, SD-JWT verifiable credentials, and
        did:web - for developers who build the identity layer.
      </p>

      <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
        <AnimatedButton
          animation="sparkle"
          renderButton={(props) => (
            <Button {...props} size="lg" asChild>
              <Link href="/login">Get Started</Link>
            </Button>
          )}
        />
        <AnimatedButton
          animation="shine"
          renderButton={(props) => (
            <Button {...props} variant="outline" size="lg" asChild>
              <Link href="https://docs.arcevo.id">Read Documentation</Link>
            </Button>
          )}
        />
      </div>
    </div>
  );
}
