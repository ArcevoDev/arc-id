"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function IdentitiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Identities" description="Directory of registered users" />
      <div className="flex gap-2">
        <Input placeholder="Search users..." className="max-w-sm" />
        <Button variant="secondary">Search</Button>
      </div>
      <p className="text-sm text-muted-foreground">Identity directory placeholder.</p>
    </div>
  );
}
