// src/app/(dashboard)/developer/webhooks/page.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { webhooksSdk } from "@/sdk/webhooks.sdk";
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
}

interface CreateForm {
  url: string;
  events: string;
}

const COMMON_EVENTS = [
  "USER_REGISTERED",
  "USER_LOGIN_SUCCESS",
  "USER_LOGIN_FAILED",
  "MFA_ENABLED",
  "MFA_DISABLED",
  "CREDENTIAL_ISSUED",
  "CREDENTIAL_REVOKED",
  "SESSION_CREATED",
  "SESSION_REVOKED",
  "TENANT_CREATED",
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
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
      const data = await webhooksSdk.list();
      setWebhooks(Array.isArray(data) ? data : []);
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
      const events = values.events
        .split(",")
        .map((e) => e.trim().toUpperCase())
        .filter(Boolean);
      await webhooksSdk.create({ url: values.url.trim(), events });
      reset();
      setOpen(false);
      await load();
    } catch (err: any) {
      setError(err.message ?? "Failed to create webhook");
    } finally {
      setCreating(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await webhooksSdk.test(id);
    } finally {
      setTestingId(null);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await webhooksSdk.update(id, { enabled: !enabled });
      setWebhooks((ws) =>
        ws.map((w) => (w.id === id ? { ...w, enabled: !enabled } : w)),
      );
    } catch {
      /* ignore */
    }
  };

  const columns: Column<Webhook>[] = [
    {
      key: "url",
      header: "Endpoint",
      render: (w) => (
        <div className="flex items-center gap-1.5 min-w-0">
          <code className="text-xs text-foreground truncate max-w-xs">
            {w.url}
          </code>
          <CopyButton value={w.url} />
        </div>
      ),
    },
    {
      key: "events",
      header: "Events",
      render: (w) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {w.events.slice(0, 3).map((e) => (
            <code
              key={e}
              className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
            >
              {e}
            </code>
          ))}
          {w.events.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{w.events.length - 3} more
            </span>
          )}
        </div>
      ),
    },
    {
      key: "enabled",
      header: "Active",
      width: "80px",
      render: (w) => (
        <Switch
          checked={w.enabled}
          onCheckedChange={() => handleToggle(w.id, w.enabled)}
          size="sm"
        />
      ),
    },
    {
      key: "actions",
      header: "",
      width: "130px",
      render: (w) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => handleTest(w.id)}
            disabled={testingId === w.id}
          >
            {testingId === w.id ? (
              <Icons.refresh className="w-3 h-3 animate-spin" />
            ) : (
              "Test"
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
            onClick={() => setDeleteId(w.id)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        description="Receive real-time HTTP notifications for identity events."
        action={
          <Button
            size="sm"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            <Icons.plus className="w-3.5 h-3.5 mr-1.5" />
            Add endpoint
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={webhooks}
        isLoading={loading}
        rowKey={(w) => w.id}
        emptyTitle="No webhook endpoints"
        emptyDesc="Add an HTTPS endpoint to receive event notifications."
      />

      <ConfirmActionDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
        title="Delete webhook?"
        description="Event deliveries to this endpoint will stop immediately."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await webhooksSdk.delete(deleteId!);
          await load();
          setDeleteId(null);
        }}
      />

      <Dialog open={open} onOpenChange={(v) => !creating && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add webhook endpoint</DialogTitle>
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
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input
                id="wh-url"
                type="url"
                placeholder="https://myapp.com/webhooks/arcid"
                {...register("url", { required: "URL is required" })}
              />
              {errors.url && (
                <p className="text-xs text-destructive">{errors.url.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wh-events">
                Events{" "}
                <span className="text-muted-foreground text-xs">
                  (comma-separated)
                </span>
              </Label>
              <Input
                id="wh-events"
                placeholder="USER_REGISTERED, USER_LOGIN_SUCCESS"
                {...register("events", {
                  required: "At least one event is required",
                })}
              />
              {errors.events && (
                <p className="text-xs text-destructive">
                  {errors.events.message}
                </p>
              )}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {COMMON_EVENTS.slice(0, 6).map((e) => (
                  <code
                    key={e}
                    className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground cursor-default"
                  >
                    {e}
                  </code>
                ))}
              </div>
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
                    Adding…
                  </>
                ) : (
                  "Add endpoint"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
