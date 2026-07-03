// src/app/(dashboard)/security/sessions/page.tsx
"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSessions } from "@/hooks/use-sessions";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmActionDialog } from "@/components/arc/dialogs";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { Session } from "@/hooks/use-sessions";

function DeviceIcon({ ua }: { ua: string | null }) {
  const s = ua?.toLowerCase() ?? "";
  if (s.includes("mobile") || s.includes("android") || s.includes("iphone"))
    return (
      <Icons.smartphone className="w-4 h-4 text-muted-foreground shrink-0" />
    );
  if (s.includes("tablet") || s.includes("ipad"))
    return <Icons.tablet className="w-4 h-4 text-muted-foreground shrink-0" />;
  return <Icons.monitor className="w-4 h-4 text-muted-foreground shrink-0" />;
}

function parseBrowser(ua: string | null) {
  if (!ua) return "Unknown device";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.split(" ")[0] ?? "Browser";
}

export default function SessionsPage() {
  const { currentSessionId } = useAuth();
  const { sessions, loading, refresh, revoke } = useSessions();
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Set<string>>(new Set());

  const handleRevoke = async () => {
    if (!revokeId) return;
    const id = revokeId;
    setRevoking((s) => new Set(s).add(id));
    try {
      await revoke(id);
    } finally {
      setRevoking((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      setRevokeId(null);
    }
  };

  const columns: Column<Session>[] = [
    {
      key: "device",
      header: "Device",
      render: (s) => (
        <div className="flex items-center gap-2">
          <DeviceIcon ua={s.userAgent} />
          <div>
            <p className="text-sm font-medium text-foreground">
              {parseBrowser(s.userAgent)}
            </p>
            {s.ip && (
              <p className="text-[11px] text-muted-foreground">{s.ip}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "auth",
      header: "Auth level",
      width: "120px",
      render: (s) => (
        <Badge variant="outline" className="text-[11px] font-mono">
          {s.authLevel ?? "aal1"}
        </Badge>
      ),
    },
    {
      key: "created",
      header: "Started",
      width: "160px",
      render: (s) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "expires",
      header: "Expires",
      width: "160px",
      render: (s) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(s.expiresAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (s) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={s.valid ? "ACTIVE" : "REVOKED"} />
          {s.id === currentSessionId && (
            <Badge
              variant="outline"
              className="text-[10px] text-primary border-primary/30"
            >
              current
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "80px",
      render: (s) =>
        s.id === currentSessionId ? null : (
          <Button
            variant="ghost"
            size="sm"
            disabled={revoking.has(s.id)}
            onClick={() => setRevokeId(s.id)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
          >
            Revoke
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions"
        description="Active login sessions across all your devices."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <Icons.refresh
              className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={sessions}
        isLoading={loading}
        rowKey={(s) => s.id}
        emptyTitle="No active sessions"
        emptyDesc="All sessions have been revoked or expired."
      />

      <ConfirmActionDialog
        open={!!revokeId}
        onOpenChange={(v) => !v && setRevokeId(null)}
        title="Revoke session?"
        description="This will immediately sign out the device using this session. Active tokens will be invalidated."
        confirmLabel="Revoke"
        destructive
        onConfirm={handleRevoke}
      />
    </div>
  );
}
