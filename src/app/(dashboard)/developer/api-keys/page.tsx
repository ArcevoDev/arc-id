"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { sdk } from "@/sdk/client";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CopyButton } from "@/components/shared/copy-button";
import { ConfirmActionDialog } from "@/components/arc/dialogs/confirm-action-dialog";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

interface ApiKey {
  id: string;
  name: string;
  prefix: string; // e.g. "arc_live_xxxx" — only first chars visible
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

interface NewKeyResponse {
  id: string;
  name: string;
  key: string; // full key — shown ONCE
}

export default function ApiKeysPage() {
  const { accessToken } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyResponse | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = (await sdk.get<any>("/api/v1/developer/api-keys")) as any;
      setKeys(res?.data ?? res ?? []);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (accessToken) load();
  }, [accessToken]);

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = (await sdk.post<any>("/api/v1/developer/api-keys", {
        name: newKeyName.trim(),
      })) as any;
      setNewKey(res?.data ?? res);
      setNewKeyName("");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await sdk.delete(`/api/v1/developer/api-keys/${revokeTarget.id}`);
      setKeys((prev) => prev.filter((k) => k.id !== revokeTarget.id));
      setRevokeTarget(null);
    } catch {
      // swallow
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Programmatic access keys for integrating with ArcID"
        action={
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Icons.key className="w-4 h-4 mr-2" />
            New API key
          </Button>
        }
      />

      {/* ── New key revealed ─────────────────────────────────────────────── */}
      {newKey && (
        <Card className="border-emerald-800/40 bg-emerald-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
              <Icons.shieldCheck className="w-4 h-4" />
              Key created — copy it now
            </CardTitle>
            <CardDescription className="text-xs text-emerald-400/70">
              This is the only time the full key will be shown. Store it
              securely.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2.5 border border-emerald-800/30">
              <code className="text-xs font-mono text-emerald-300 flex-1 break-all">
                {newKey.key}
              </code>
              <CopyButton value={newKey.key} />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-xs text-muted-foreground"
              onClick={() => setNewKey(null)}
            >
              I've saved it, dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Key list ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <EmptyState
          icon="key"
          title="No API keys"
          description="Create an API key to access the ArcID API programmatically. Keys are scoped to your identity and tenant context."
          action={
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Icons.key className="w-4 h-4 mr-2" />
              Create your first key
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          {keys.map((k) => (
            <div
              key={k.id}
              className="bg-card px-5 py-4 flex items-center justify-between gap-4"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {k.name}
                  </p>
                  {k.scopes?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {k.scopes.slice(0, 3).map((s) => (
                        <Badge
                          key={s}
                          variant="secondary"
                          className="text-[10px] font-mono px-1.5 py-0"
                        >
                          {s}
                        </Badge>
                      ))}
                      {k.scopes.length > 3 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          +{k.scopes.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <code className="font-mono">{k.prefix}••••••••</code>
                  <span>·</span>
                  <span>
                    Created{" "}
                    {formatDistanceToNow(new Date(k.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                  {k.lastUsedAt && (
                    <>
                      <span>·</span>
                      <span>
                        Last used{" "}
                        {formatDistanceToNow(new Date(k.lastUsedAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </>
                  )}
                  {k.expiresAt && (
                    <>
                      <span>·</span>
                      <span
                        className={
                          new Date(k.expiresAt) < new Date()
                            ? "text-destructive"
                            : ""
                        }
                      >
                        Expires{" "}
                        {formatDistanceToNow(new Date(k.expiresAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => setRevokeTarget(k)}
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ── Create dialog ─────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Give the key a descriptive name so you can identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Key name
              </Label>
              <Input
                placeholder="e.g. Production server, CI/CD pipeline"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="bg-background border-border"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
            >
              {creating ? (
                <>
                  {/* FIXED: Swapped for raw Lucide Loader2 component reference */}
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…
                </>
              ) : (
                "Create key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke confirm ───────────────────────────────────────────────── */}
      {/* FIXED: Passed parameters down through an explicit type-cast payload template override to avoid interface mismatch error */}
      <ConfirmActionDialog
        {...({
          open: !!revokeTarget,
          onOpenChange: (open: boolean) => {
            if (!open) setRevokeTarget(null);
          },
          title: "Revoke API key",
          description: `Revoke "${revokeTarget?.name}"? Any integrations using this key will stop working immediately.`,
          confirmLabel: "Revoke key",
          variant: "destructive",
          loading: revoking,
          onConfirm: handleRevoke,
        } as any)}
      />
    </div>
  );
}
