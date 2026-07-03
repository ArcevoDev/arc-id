// src/app/(dashboard)/oauth/applications/page.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { oauthSdk } from "@/sdk/oauth.sdk";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { CopyButton } from "@/components/shared/copy-button";
import { ConfirmActionDialog } from "@/components/arc/dialogs";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

interface OAuthClient {
  id: string;
  clientId: string;
  name: string;
  public: boolean;
  requirePkce: boolean;
  grantTypes: string[];
  createdAt: string;
}

interface CreateForm {
  name: string;
  public: boolean;
  requirePkce: boolean;
  redirectUri: string;
}

const ALL_GRANTS = [
  "authorization_code",
  "refresh_token",
  "client_credentials",
];

export default function OAuthAppsPage() {
  const [clients, setClients] = useState<OAuthClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateForm>({
    defaultValues: { public: false, requirePkce: true },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await oauthSdk.listClients();
      setClients(Array.isArray(data) ? data : []);
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
      await oauthSdk.createClient({
        name: values.name.trim(),
        public: values.public,
        requirePkce: values.requirePkce,
        grantTypes: ["authorization_code", "refresh_token"],
        scopes: ["openid", "profile", "email", "offline_access"],
        redirectUris: [values.redirectUri.trim()],
      });
      reset();
      setOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message ?? "Failed to create client");
    } finally {
      setCreating(false);
    }
  };

  const columns: Column<OAuthClient>[] = [
    {
      key: "name",
      header: "Application",
      render: (c) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icons.key className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{c.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <code className="text-[10px] font-mono text-muted-foreground">
                {c.clientId}
              </code>
              <CopyButton value={c.clientId} />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      width: "100px",
      render: (c) => (
        <Badge
          variant="outline"
          className={`text-[11px] ${c.public ? "text-amber-400 border-amber-500/20" : "text-blue-400 border-blue-500/20"}`}
        >
          {c.public ? "Public" : "Confidential"}
        </Badge>
      ),
    },
    {
      key: "pkce",
      header: "PKCE",
      width: "80px",
      render: (c) => (
        <Badge
          variant="outline"
          className={`text-[11px] ${c.requirePkce ? "text-emerald-400 border-emerald-500/20" : "text-muted-foreground"}`}
        >
          {c.requirePkce ? "Required" : "Optional"}
        </Badge>
      ),
    },
    {
      key: "grants",
      header: "Grant types",
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          {(c.grantTypes as string[]).map((g) => (
            <code
              key={g}
              className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
            >
              {g}
            </code>
          ))}
        </div>
      ),
    },
    {
      key: "created",
      header: "Created",
      width: "120px",
      render: (c) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "80px",
      render: (c) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteId(c.id)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="OAuth Applications"
        description="Manage OAuth 2.0 clients for your integrations."
        action={
          <Button
            size="sm"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            <Icons.plus className="w-3.5 h-3.5 mr-1.5" />
            New application
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={clients}
        isLoading={loading}
        rowKey={(c) => c.id}
        emptyTitle="No applications"
        emptyDesc="Create an OAuth client to enable third-party integrations."
      />

      <ConfirmActionDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="Delete application?"
        description="All tokens issued to this client will be immediately revoked. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await oauthSdk.deleteClient(deleteId!);
          await load();
          setDeleteId(null);
        }}
      />

      <Dialog open={open} onOpenChange={(v) => !creating && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New OAuth application</DialogTitle>
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
              <Label htmlFor="app-name">Application name</Label>
              <Input
                id="app-name"
                placeholder="My App"
                {...register("name", { required: "Name is required" })}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="redirect-uri">Redirect URI</Label>
              <Input
                id="redirect-uri"
                placeholder="https://myapp.com/callback"
                {...register("redirectUri", {
                  required: "At least one redirect URI is required",
                })}
              />
              {errors.redirectUri && (
                <p className="text-xs text-destructive">
                  {errors.redirectUri.message}
                </p>
              )}
            </div>

            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={watch("public")}
                  onCheckedChange={(v) => setValue("public", !!v)}
                />
                <span className="text-sm text-foreground">Public client</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={watch("requirePkce")}
                  onCheckedChange={(v) => setValue("requirePkce", !!v)}
                />
                <span className="text-sm text-foreground">Require PKCE</span>
              </label>
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
