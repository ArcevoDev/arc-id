"use client";

import Link from "next/link";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@arcevo/facet-components";
import { Icon } from "@/components/ui/icon";
import { useTenant } from "@/hooks/use-tenant";

export default function OrganizationOverviewPage() {
  const { activeTenant, tenants } = useTenant();

  if (!activeTenant) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No active organization. Visit the tenants page to switch or create one.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Organization details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{activeTenant.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Slug</span>
            <span className="text-sm font-medium font-mono">{activeTenant.slug}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Plan</span>
            <Badge variant="default">{activeTenant.plan ?? "Free"}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Your role</span>
            <span className="text-sm font-medium">{activeTenant.role ?? "member"}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/organization/members" className="group">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <Icon name="users" className="h-6 w-6 text-primary mb-2" />
              <CardTitle className="text-base">Members</CardTitle>
              <CardDescription>Manage who belongs to this organization</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/organization/billing" className="group">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardHeader>
              <Icon name="credit-card" className="h-6 w-6 text-primary mb-2" />
              <CardTitle className="text-base">Billing</CardTitle>
              <CardDescription>Subscription and plan management</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {tenants.length > 1 && (
        <p className="text-xs text-muted-foreground">
          You belong to {tenants.length} organizations. Switch via the topbar switcher.
        </p>
      )}
    </div>
  );
}
