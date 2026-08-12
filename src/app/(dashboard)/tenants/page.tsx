"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@arcevo/facet-components";

export default function TenantsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Organisations you belong to"
        actions={<Button>Create organisation</Button>}
      />
      <p className="text-sm text-muted-foreground">Tenant list placeholder.</p>
    </div>
  );
}
