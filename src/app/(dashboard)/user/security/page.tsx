"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Icon } from "@arcevo/facet-components";

const SECURITY_SECTIONS = [
  {
    href: "/security/mfa",
    title: "Two-factor authentication",
    description: "Protect your account with an authenticator app",
    icon: "lock" as const,
  },
  {
    href: "/security/passkeys",
    title: "Passkeys",
    description: "Manage WebAuthn passkeys for passwordless sign-in",
    icon: "key-round" as const,
  },
  {
    href: "/security/sessions",
    title: "Sessions",
    description: "View and revoke active login sessions",
    icon: "monitor" as const,
  },
  {
    href: "/security/audit",
    title: "Audit log",
    description: "Review security-relevant events",
    icon: "scroll-text" as const,
  },
];

export default function UserSecurityPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {SECURITY_SECTIONS.map((s) => (
        <Link key={s.href} href={s.href} className="group">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <Icon name={s.icon} className="h-6 w-6 text-primary mb-2" />
              <CardTitle className="text-base">{s.title}</CardTitle>
              <CardDescription>{s.description}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
