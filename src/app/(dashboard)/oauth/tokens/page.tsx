// src/app/(dashboard)/oauth/tokens/page.tsx
"use client";
import { useState } from "react";
import { useOAuthTokens } from "@/hooks/use-oauth-tokens";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { ConfirmActionDialog } from "@/components/arc";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { ActiveToken } from "@/hooks/use-oauth-tokens";

export default function TokensPage() {
  const { tokens, loading, refresh, revoke } = useOAuthTokens();
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const columns: Column<ActiveToken>[] = [
    {
      key: "client",
      header: "Application",
      render: (t) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
            <Icons.key className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm text-foreground">{t.clientName}</span>
        </div>
      ),
    },
    {
      key: "scopes",
      header: "Scopes",
      render: (t) => (
        <div className="flex flex-wrap gap-1">
          {(t.scopes ?? []).map((s) => (
            <code
              key={s}
              className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
            >
              {s}
            </code>
          ))}
        </div>
      ),
    },
    {
      key: "issued",
      header: "Issued",
      width: "140px",
      render: (t) => (
        <span className="text-xs text-muted-foreground">
          {t.issuedAt
            ? formatDistanceToNow(new Date(t.issuedAt), { addSuffix: true })
            : "—"}
        </span>
      ),
    },
    {
      key: "expires",
      header: "Expires",
      width: "140px",
      render: (t) => (
        <span className="text-xs text-muted-foreground">
          {t.expiresAt
            ? formatDistanceToNow(new Date(t.expiresAt), { addSuffix: true })
            : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (t) => (
        <Badge
          variant="outline"
          className={`text-[11px] ${t.revoked ? "text-red-400 border-red-500/20" : "text-emerald-400 border-emerald-500/20"}`}
        >
          {t.revoked ? "Revoked" : "Active"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "80px",
      render: (t) =>
        !t.revoked ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRevokeId(t.id)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
          >
            Revoke
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active Tokens"
        description="Access tokens currently issued to OAuth applications."
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
        data={tokens}
        isLoading={loading}
        rowKey={(t) => t.id}
        emptyTitle="No active tokens"
        emptyDesc="Access tokens issued via the OAuth 2.0 authorization flow appear here."
      />

      <ConfirmActionDialog
        open={!!revokeId}
        onOpenChange={(v) => !v && setRevokeId(null)}
        title="Revoke token?"
        description="The application using this token will be signed out immediately."
        confirmLabel="Revoke"
        destructive
        onConfirm={async () => {
          await revoke(revokeId!);
          setRevokeId(null);
        }}
      />
    </div>
  );
}
