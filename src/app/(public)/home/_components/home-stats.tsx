"use client";

import { StatCard } from "@arcevo/facet-components";

const stats = [
  { value: "OIDC", label: "Full OAuth2 provider" },
  { value: "WebAuthn", label: "Passkey auth" },
  { value: "SD-JWT", label: "VC with selective disclosure" },
  { value: "MFA", label: "TOTP + recovery" },
];

export function HomeStats() {
  return (
    <section id="stats" className="border-t py-12">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard
              key={stat.value}
              label={stat.label}
              value={stat.value}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
