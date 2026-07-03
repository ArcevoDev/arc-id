// src/app/(dashboard)/security/audit/page.tsx
"use client";
import { useState } from "react";
import { useAuditLog } from "@/hooks/use-audit-log";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDistanceToNow } from "date-fns";
import type { AuditEntry } from "@/hooks/use-audit-log";

const ACTION_COLORS: Record<string, string> = {
  USER_LOGIN_SUCCESS:
    "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  USER_LOGIN_FAILED: "text-red-400    border-red-500/20    bg-red-500/10",
  USER_REGISTERED: "text-blue-400   border-blue-500/20   bg-blue-500/10",
  PASSWORD_CHANGED: "text-amber-400  border-amber-500/20  bg-amber-500/10",
  MFA_ENABLED: "text-violet-400 border-violet-500/20 bg-violet-500/10",
  MFA_DISABLED: "text-orange-400 border-orange-500/20 bg-orange-500/10",
  SESSION_REVOKED: "text-red-400    border-red-500/20    bg-red-500/10",
  SESSION_REVOKED_ALL: "text-red-400    border-red-500/20    bg-red-500/10",
  PASSKEY_REGISTERED: "text-indigo-400 border-indigo-500/20 bg-indigo-500/10",
  PASSKEY_USED: "text-indigo-400 border-indigo-500/20 bg-indigo-500/10",
  PROFILE_UPDATED: "text-cyan-400   border-cyan-500/20   bg-cyan-500/10",
  TENANT_CREATED: "text-teal-400   border-teal-500/20   bg-teal-500/10",
};

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const { entries, loading, page, setPage, total, totalPages, refresh } =
    useAuditLog(debouncedSearch);

  const columns: Column<AuditEntry>[] = [
    {
      key: "action",
      header: "Action",
      render: (e) => {
        const cls =
          ACTION_COLORS[e.action] ??
          "text-muted-foreground border-border bg-muted";
        return (
          <Badge variant="outline" className={`text-[11px] font-mono ${cls}`}>
            {e.action}
          </Badge>
        );
      },
    },
    {
      key: "ip",
      header: "IP",
      width: "120px",
      render: (e) => (
        <span className="text-xs text-muted-foreground font-mono">
          {e.ip ?? "—"}
        </span>
      ),
    },
    {
      key: "meta",
      header: "Details",
      render: (e) => {
        if (!e.metadata)
          return <span className="text-xs text-muted-foreground">—</span>;
        const { reason, fields, ...rest } = e.metadata;
        const label =
          reason ??
          (fields ? fields.join(", ") : JSON.stringify(rest).slice(0, 60));
        return (
          <span className="text-xs text-muted-foreground truncate max-w-xs">
            {label}
          </span>
        );
      },
    },
    {
      key: "time",
      header: "When",
      width: "140px",
      render: (e) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="A chronological record of all security-relevant events."
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

      <div className="flex items-center gap-3">
        <div className="relative w-64">
          <Icons.search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter by action…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {search && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSearch("")}
          >
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={entries}
        isLoading={loading}
        rowKey={(e) => e.id}
        emptyTitle="No audit events"
        emptyDesc={
          search
            ? `No events matching "${search}"`
            : "Events will appear here as you use ArcID."
        }
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {total} total events
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <Icons.arrowLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <Icons.arrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
