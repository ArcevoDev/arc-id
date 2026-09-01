"use client";

import { PageHeader } from "@arcevo/facet-layout";
import {
  GlowCard,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@arcevo/facet-components";
import { useTenantStore } from "@arcevo/facet-store";
import Link from "next/link";

export default function OrganizationPage() {
  const { activeTenant } = useTenantStore();

  return (
    <>
      <PageHeader
        title="Organization"
        description="Your organization and workspace settings."
      />
      <main className="p-6">
        <div className="grid gap-6 md:max-w-3xl">
          <GlowCard>
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
              <CardDescription>
                {activeTenant?.name ?? "No tenant selected"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/console/tenants"
                className="text-sm underline"
              >
                Switch tenant
              </Link>
            </CardContent>
          </GlowCard>

          <GlowCard>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>
                Manage who has access to this workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/console/organization/members"
                className="text-sm underline"
              >
                Manage members
              </Link>
            </CardContent>
          </GlowCard>

        </div>
      </main>
    </>
  );
}
