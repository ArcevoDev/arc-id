"use client";

import { useEffect } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import { AnimatedButton, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, HoverScaleCard } from "@arcevo/facet-components";
import { useTenantStore } from "@arcevo/facet-store";
import { useTenant } from "@/hooks/use-tenant";
import Link from "next/link";

export default function TenantsPage() {
  const { tenants, activeTenant, setActiveTenant } = useTenantStore();
  const { hydrateTenants } = useTenant();

  useEffect(() => {
    void hydrateTenants();
  }, [hydrateTenants]);

  return (
    <>
      <PageHeader title="Tenants" description="Your workspace tenants." />
      <main className="p-6">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Workspaces</h2>
          <AnimatedButton
            animation="sparkle"
            renderButton={(props) => (
              <Button {...props} asChild>
                <Link href="/console/tenants/new">New Tenant</Link>
              </Button>
            )}
          />
        </div>

        <div className="space-y-4">
          {tenants.map((t) => (
            <Card
              key={t.id}
              className={activeTenant?.id === t.id ? "border-primary" : ""}
            >
              <CardHeader>
                <CardTitle>{t.name}</CardTitle>
                <CardDescription>@{t.slug}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant={activeTenant?.id === t.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTenant(t)}
                >
                  {activeTenant?.id === t.id ? "Active" : "Switch to"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
