"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@arcevo/facet-layout";
import {
  AnimatedButton,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@arcevo/facet-components";
import { useTenant } from "@/hooks/use-tenant";

export default function CreateTenantPage() {
  const router = useRouter();
  const { createTenant } = useTenant();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await createTenant(name, slug);
    if (result.error) {
      setError(result.error.message ?? "Failed to create tenant.");
    } else {
      router.replace("/console/tenants");
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <PageHeader
        title="New Tenant"
        description="Create a new workspace tenant."
      />
      <main className="p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Tenant Details</CardTitle>
            <CardDescription>
              Enter a name and a unique slug for the new tenant.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme, Inc."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="acme"
                  required
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-3">
                <AnimatedButton
                  animation="sparkle"
                  renderButton={(props) => (
                    <Button {...props} type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Creating…" : "Create Tenant"}
                    </Button>
                  )}
                />
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
