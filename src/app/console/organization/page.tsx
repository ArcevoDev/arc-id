"use client";

import { PageHeader } from "@arcevo/facet-layout";
import {
  Card,
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
          <Card>
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
          </Card>

          <Card>
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
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>
                Subscription and payment details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/console/billing"
                className="text-sm underline"
              >
                Manage billing
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
