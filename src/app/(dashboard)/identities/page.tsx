// src/app/(dashboard)/identities/page.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { identitySdk } from "@/sdk/identity.sdk";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmActionDialog } from "@/components/arc/dialogs";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDistanceToNow } from "date-fns";

interface Identity {
  id: string;
  name: string | null;
  primaryEmail: string | null;
  status: string;
  createdAt: string;
}

export default function IdentitiesPage() {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [suspendId, setSuspendId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 400);

  const LIMIT = 20;

  const load = useCallback(async (p: number, q?: string) => {
    setLoading(true);
    try {
      const data = await identitySdk.list({ page: p, limit: LIMIT, search: q });
      const rows = Array.isArray(data) ? data : (data?.data ?? []);
      setIdentities(rows);
      setTotal(data?.total ?? rows.length);
    } catch {
      // SYSTEM ADMIN only — if 403, show empty state
      setIdentities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    load(1, debouncedSearch || undefined);
  }, [debouncedSearch, load]);

  useEffect(() => {
    load(page, debouncedSearch || undefined);
  }, [page, load, debouncedSearch]);

  const handleSuspend = async () => {
    if (!suspendId) return;
    await identitySdk.setStatus(suspendId, "SUSPENDED");
    await load(page, debouncedSearch || undefined);
    setSuspendId(null);
  };

  const totalPages = Math.ceil(total / LIMIT);

  const columns: Column<Identity>[] = [
    {
      key: "identity",
      header: "Identity",
      render: (id) => {
        const initials = id.name
          ? id.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
          : (id.primaryEmail?.[0]?.toUpperCase() ?? "?");
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="w-7 h-7">
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">
                {id.name ?? "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {id.primaryEmail}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: "110px",
      render: (id) => <StatusBadge status={id.status} />,
    },
    {
      key: "created",
      header: "Joined",
      width: "140px",
      render: (id) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(id.createdAt), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "100px",
      render: (id) =>
        id.status === "ACTIVE" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuspendId(id.id)}
            className="text-amber-500 hover:text-amber-500 hover:bg-amber-500/10 h-7 px-2 text-xs"
          >
            Suspend
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identities"
        description="All registered users in this ArcID instance. Requires SYSTEM admin role."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(page)}
            disabled={loading}
          >
            <Icons.refresh
              className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      />

      <div className="relative w-64">
        <Icons.search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={identities}
        isLoading={loading}
        rowKey={(id) => id.id}
        emptyTitle="No identities found"
        emptyDesc={
          search
            ? `No results for "${search}"`
            : "No identities in this instance, or you need SYSTEM ADMIN access."
        }
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {total} identities
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

      <ConfirmActionDialog
        open={!!suspendId}
        onOpenChange={(v) => !v && setSuspendId(null)}
        title="Suspend identity?"
        description="The user will be immediately locked out of their account. Active sessions will remain valid until they expire."
        confirmLabel="Suspend"
        destructive
        onConfirm={handleSuspend}
      />
    </div>
  );
}
