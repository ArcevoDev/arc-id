"use client";

import Link from "next/link";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@arcevo/facet-components";
import Icon from "@/components/ui/icon";

const heroCode = `1. Discover  GET /.well-known/openid-configuration
   { authorization_endpoint, token_endpoint, jwks_uri }

2. Authorize   302 → /oauth/authorize?response_type=code
   &code_challenge=...&code_challenge_method=S256

3. Token       POST /oauth/token  (code + code_verifier)
   → access_token  id_token  refresh_token

4. Verify      id_token  @ jwks_uri
   (kid from JWT header · alg never hardcoded)`;

export function HomeHero() {
  return (
    <div className="text-center">
      <Badge variant="outline" className="mb-6">
        Sovereign identity for the decentralized web
      </Badge>

      <h1 className="text-5xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
        Own your identity.
        <br />
        Verify anything.
        <br />
        Trust nothing.
      </h1>

      <p className="text-muted-foreground mx-auto mt-8 max-w-2xl text-lg">
        ArcID is a sovereign multi-tenant IAM backend providing OIDC,
        WebAuthn passkeys, TOTP MFA, SD-JWT verifiable credentials, and
        did:web — for developers who build the identity layer.
      </p>

      <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
        <Button size="lg" asChild>
          <Link href="/login">Get Started</Link>
        </Button>
        <Button variant="outline" size="lg" asChild>
          <Link href="https://docs.arcevo.id">Read Documentation</Link>
        </Button>
      </div>

      {/* Hero consumption card */}
      <Card className="mx-auto mt-16 max-w-3xl border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Icon name="terminal" className="h-5 w-5 text-primary" />
            <CardTitle>OAuth2 / OIDC consumption</CardTitle>
          </div>
          <CardDescription>
            Discover, redirect with PKCE (S256), exchange, verify with JWKS
            at /oauth/jwks — the standard 3rd-party relying-party flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-4">
            <code className="font-mono text-sm text-muted-foreground">
              {heroCode}
            </code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
