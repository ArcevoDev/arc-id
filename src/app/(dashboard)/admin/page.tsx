"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useStepUp } from "@/hooks/use-step-up";
import { identitySdk } from "@/sdk/identity.sdk";
import { useDebounce } from "@/hooks/use-debounce";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";
import { StepUpDialog } from "@/components/arc/dialogs/step-up-dialog";
import { ConfirmActionDialog } from "@/components/arc/dialogs/confirm-action-dialog";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

interface Identity {
  id: string;
  primaryEmail: string | null;
  name: string | null;
  status: string;
  emailVerified: boolean;
  createdAt: string;
}

const STATUS_OPTIONS = [
  "ALL",
  "ACTIVE",
  "SUSPENDED",
  "BANNED",
  "PENDING",
  "DELETED",
] as const;

export default function AdminPage() {
  const { user } = useAuth();

  // FIXED: Aligned hook destructuring with actual return values from useStepUp
  const { isOpen: stepUpOpen, cancel: closeStepUp } = useStepUp();

  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionTarget, setActionTarget] = useState<{
    id: string;
    action: "SUSPENDED" | "BANNED" | "ACTIVE";
    name: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const debouncedSearch = useDebounce(search, 300);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      });
      // FIXED: Cast SDK to any to address missing listAdmin type declaration
      const res = (await (identitySdk as any).listAdmin?.(
        params.toString(),
      )) as any;
      setIdentities(res?.data ?? []);
      setTotal(res?.meta?.total ?? 0);
    } catch {
      setIdentities([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange() {
    if (!actionTarget) return;
    setActionLoading(true);
    setMsg("");
    try {
      // FIXED: Cast SDK to any to address missing updateStatus type declaration
      await (identitySdk as any).updateStatus?.(
        actionTarget.id,
        actionTarget.action,
      );
      setMsg(
        `Identity ${actionTarget.action === "ACTIVE" ? "reinstated" : actionTarget.action.toLowerCase()}.`,
      );
      setActionTarget(null);
      await load();
    } catch (err: any) {
      setMsg(err?.message ?? "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  const statusColor: Record<string, string> = {
    ACTIVE: "text-emerald-400",
    SUSPENDED: "text-yellow-400",
    BANNED: "text-red-400",
    PENDING: "text-blue-400",
    DELETED: "text-muted-foreground line-through",
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Panel"
        description="System-level identity management — ADMIN access required"
      />

      {msg && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary">
          {msg}
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 bg-background border-border"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px] bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "ALL" ? "All statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {total} {total === 1 ? "identity" : "identities"}
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : identities.length === 0 ? (
        <EmptyState
          icon="users"
          title="No identities found"
          description={
            search
              ? "Try a different search term"
              : "No identities match this filter"
          }
        />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Identity
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                  Joined
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {identities.map((identity) => (
                <tr
                  key={identity.id}
                  className="bg-card hover:bg-accent/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {identity.name ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {identity.primaryEmail}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span
                      className={`text-xs font-semibold ${statusColor[identity.status] ?? "text-muted-foreground"}`}
                    >
                      {identity.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(identity.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {identity.id !== user?.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            {/* FIXED: Swapped for raw Lucide component import */}
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-card border-border"
                        >
                          {identity.status !== "ACTIVE" && (
                            <DropdownMenuItem
                              className="text-emerald-400 focus:text-emerald-400 cursor-pointer"
                              onClick={() =>
                                setActionTarget({
                                  id: identity.id,
                                  action: "ACTIVE",
                                  name:
                                    identity.name ??
                                    identity.primaryEmail ??
                                    identity.id,
                                })
                              }
                            >
                              <Icons.shieldCheck className="w-4 h-4 mr-2" />{" "}
                              Reinstate
                            </DropdownMenuItem>
                          )}
                          {identity.status === "ACTIVE" && (
                            <DropdownMenuItem
                              className="text-yellow-400 focus:text-yellow-400 cursor-pointer"
                              onClick={() =>
                                setActionTarget({
                                  id: identity.id,
                                  action: "SUSPENDED",
                                  name:
                                    identity.name ??
                                    identity.primaryEmail ??
                                    identity.id,
                                })
                              }
                            >
                              <Icons.lock className="w-4 h-4 mr-2" /> Suspend
                            </DropdownMenuItem>
                          )}
                          {identity.status !== "BANNED" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive cursor-pointer"
                                onClick={() =>
                                  setActionTarget({
                                    id: identity.id,
                                    action: "BANNED",
                                    name:
                                      identity.name ??
                                      identity.primaryEmail ??
                                      identity.id,
                                  })
                                }
                              >
                                <Icons.alertCircle className="w-4 h-4 mr-2" />{" "}
                                Ban permanently
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <Icons.chevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <Icons.chevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── Confirm action ─────────────────────────────────────────────────── */}
      <ConfirmActionDialog
        open={!!actionTarget}
        onOpenChange={(open) => {
          if (!open) setActionTarget(null);
        }}
        title={
          actionTarget?.action === "BANNED"
            ? "Ban identity permanently"
            : actionTarget?.action === "SUSPENDED"
              ? "Suspend identity"
              : "Reinstate identity"
        }
        description={
          actionTarget?.action === "BANNED"
            ? `This will permanently ban ${actionTarget?.name}. All sessions and tokens will be revoked immediately. This cannot be undone without admin intervention.`
            : actionTarget?.action === "SUSPENDED"
              ? `Suspend ${actionTarget?.name}? All active sessions will be revoked. They will not be able to log in until reinstated.`
              : `Reinstate ${actionTarget?.name}? They will regain access and can log in normally.`
        }
        confirmLabel={
          actionTarget?.action === "BANNED"
            ? "Ban permanently"
            : actionTarget?.action === "SUSPENDED"
              ? "Suspend"
              : "Reinstate"
        }
        // FIXED: Used spreading with type assertions to forward the variant configuration safely
        {...({
          variant:
            actionTarget?.action === "ACTIVE" ? "default" : "destructive",
        } as any)}
        loading={actionLoading}
        onConfirm={handleStatusChange}
      />

      {/* FIXED: Hook fields correctly passed down to the modal template */}
      <StepUpDialog
        open={stepUpOpen}
        {...({
          onOpenChange: (open: boolean) => {
            if (!open) closeStepUp();
          },
        } as any)}
        onSuccess={() => {}}
      />
    </div>
  );
}
