"use client";

import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@arcevo/facet-components";
import { PageHeader } from "@arcevo/facet-layout";
import { useAuthStore, useTenantStore } from "@arcevo/facet-store";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const quickActions = [
  { label: "Credentials", href: "/console/credentials", desc: "Issue, verify, and manage verifiable credentials" },
  { label: "Sessions", href: "/console/security/sessions", desc: "View and revoke active sessions" },
  { label: "Passkeys", href: "/console/security/passkeys", desc: "Manage your WebAuthn passkeys" },
  { label: "MFA", href: "/console/security/mfa", desc: "Configure multi-factor authentication" },
];

export default function ConsoleDashboardPage() {
  const { user, accessToken } = useAuthStore();
  const { activeTenant } = useTenantStore();
  const router = useRouter();

  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
    }
  }, [accessToken, router]);

  if (!accessToken) return null;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name ?? "there"}`}
        description={activeTenant ? `${activeTenant.name} Console` : "Select a tenant to get started"}
      />

      <main className="p-6">
        {activeTenant && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Current Workspace</CardTitle>
              <CardDescription>
                You're working in <strong>{activeTenant.name}</strong>.
                Switch tenants from the sidebar.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {!activeTenant && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>No workspace selected</CardTitle>
              <CardDescription>
                You don't have access to any tenant yet. Create one or
                wait for an invitation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/console/tenants">Manage Tenants</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle>{action.label}</CardTitle>
                  <CardDescription>{action.desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
