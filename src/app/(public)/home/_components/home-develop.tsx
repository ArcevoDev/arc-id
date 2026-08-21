"use client";

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@arcevo/facet-components";
import Icon, { type IconProps } from "@/components/ui/icon";

const steps = [
  {
    title: "Discover",
    icon: "globe",
    desc: "GET /.well-known/openid-configuration — pull authorization_endpoint, token_endpoint and jwks_uri. code_challenge_methods_supported includes S256.",
  },
  {
    title: "Authorize",
    icon: "shield-check",
    desc: "Redirect to /oauth/authorize?response_type=code&client_id=...&code_challenge=...&code_challenge_method=S256 (PKCE enforced).",
  },
  {
    title: "Token",
    icon: "key-round",
    desc: "POST /oauth/token with the code + code_verifier → access_token, id_token, refresh_token.",
  },
  {
    title: "Verify",
    icon: "badge-check",
    desc: "Verify the id_token against /oauth/jwks — read kid from the JWT header, never hardcode the algorithm.",
  },
];

export function HomeDevelop() {
  return (
    <section id="develop" className="border-t py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">
            OAuth2 / OIDC provider
          </Badge>
          <h2 className="text-center text-3xl font-bold text-foreground mb-4">
            Consume arc-id like any 3rd-party
          </h2>
          <p className="text-muted-foreground mb-12">
            arc-id publishes a standard OpenID Connect discovery document.
            Point any OIDC library at it and authenticate with PKCE (S256) —
            no bespoke protocol.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Card key={step.title} className="flex flex-col overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary">
                    0{i + 1}
                  </span>
                  <Icon name={step.icon as IconProps["name"]} className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="break-words">
                  {step.desc}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
