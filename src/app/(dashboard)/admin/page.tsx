"use client";

import { PageHeader } from "@arcevo/facet-layout";
import { Input, Button } from "@arcevo/facet-components";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="System administration - manage identities"
        actions={<Button>Refresh</Button>}
      />
      <div className="flex gap-2">
        <Input placeholder="Search identities..." className="max-w-sm" />
        <Button variant="secondary">Search</Button>
      </div>
      <p className="text-sm text-muted-foreground">Identity list placeholder.</p>
    </div>
  );
}
