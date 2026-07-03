// src/app/(dashboard)/tenants/page.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { tenantSdk } from "@/sdk/tenant.sdk";
import { useTenant } from "@/hooks/use-tenant";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  sector: string | null;
  createdAt: string;
}

interface CreateForm {
  name: string;
  slug: string;
  sector?: string;
}

export default function TenantsPage() {
  const {
    activeTenant,
    tenants: storeTenants,
    fetchTenants,
    switchTenant,
  } = useTenant();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tenantSdk.list();
      setTenants(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async (values: CreateForm) => {
    setError(null);
    setCreating(true);
    try {
      await tenantSdk.create({
        name: values.name.trim(),
        slug: values.slug.trim().toLowerCase(),
        sector: values.sector?.trim() || undefined,
      });
      reset();
      setOpen(false);
      await load();
      await fetchTenants();
    } catch (err: any) {
      setError(err.message ?? "Failed to create tenant");
    } finally {
      setCreating(false);
    }
  };

  const columns: Column<TenantRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (t) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icons.tenant className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{t.name}</p>
            <p className="text-[11px] text-muted-foreground font-mono">
              {t.slug}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "sector",
      header: "Sector",
      width: "140px",
      render: (t) =>
        t.sector ? (
          <Badge variant="outline" className="text-[11px]">
            {t.sector}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: "created",
      header: "Created",
      width: "140px",
      render: (t) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "120px",
      render: (t) => (
        <div className="flex items-center gap-2">
          {activeTenant?.id === t.id ? (
            <Badge
              variant="outline"
              className="text-[10px] text-primary border-primary/30"
            >
              active
            </Badge>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => switchTenant(t as any)}
            >
              Switch
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Organisations and workspaces you belong to."
        action={
          <Button
            size="sm"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            <Icons.plus className="w-3.5 h-3.5 mr-1.5" />
            New tenant
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={tenants}
        isLoading={loading}
        rowKey={(t) => t.id}
        emptyTitle="No tenants yet"
        emptyDesc="Create your first organisation to get started."
      />

      <Dialog open={open} onOpenChange={(v) => !creating && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create organisation</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert
              variant="destructive"
              className="text-sm flex items-start gap-2"
            >
              <Icons.alertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Organisation name</Label>
              <Input
                id="t-name"
                placeholder="Acme Inc."
                {...register("name", { required: "Name is required" })}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-slug">Slug</Label>
              <Input
                id="t-slug"
                placeholder="acme"
                {...register("slug", {
                  required: "Slug is required",
                  pattern: {
                    value: /^[a-z0-9-]+$/,
                    message: "Lowercase letters, numbers and hyphens only",
                  },
                })}
              />
              {errors.slug && (
                <p className="text-xs text-destructive">
                  {errors.slug.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-sector">
                Sector <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="t-sector"
                placeholder="e.g. Health, Education, Finance"
                {...register("sector")}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <>
                    <Icons.refresh className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
