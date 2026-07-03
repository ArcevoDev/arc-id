// src/app/(dashboard)/dashboard/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { billingSdk } from "@/sdk/billing.sdk";
import { auditSdk } from "@/sdk/audit.sdk";
import { authSdk } from "@/sdk/auth.sdk";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Icons } from "@/lib/ui/icon-registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface Stat {
  label: string;
  value: string | number;
  icon: keyof typeof Icons;
  sub?: string;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, sub }: Stat) {
  const Icon = Icons[icon];
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {label}
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Activity row ──────────────────────────────────────────────────────────────

function ActionLabel({ action }: { action: string }) {
  return (
    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
      {action}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeTenant } = useTenant();

  const [subscription, setSubscription] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [subData, auditData, sessionData] = await Promise.allSettled([
          billingSdk.getSubscription(),
          auditSdk.list({ limit: 8 }),
          authSdk.listSessions(),
        ]);

        if (cancelled) return;

        if (subData.status === "fulfilled") setSubscription(subData.value);
        if (auditData.status === "fulfilled") {
          // audit returns { data: [...], total, page }
          const rows = Array.isArray(auditData.value)
            ? auditData.value
            : (auditData.value?.data ?? []);
          setAuditLogs(rows.slice(0, 8));
        }
        if (sessionData.status === "fulfilled") {
          setSessions(
            Array.isArray(sessionData.value) ? sessionData.value : [],
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const plan = subscription?.plan ?? "FREE";
  const activeSess = sessions.filter((s: any) => s.valid !== false).length;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(" ")[0] ?? "there"}`}
        description={
          activeTenant
            ? `${activeTenant.name} · ${plan} plan`
            : "ArcID Identity Console"
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-5 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-12" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="Plan"
              value={plan}
              icon="billing"
              sub={subscription?.status ?? ""}
            />
            <StatCard
              label="Active sessions"
              value={activeSess}
              icon="shieldCheck"
              sub="across all devices"
            />
            <StatCard
              label="Recent events"
              value={auditLogs.length}
              icon="logs"
              sub="last 8 audit entries"
            />
            <StatCard
              label="Workspace"
              value={activeTenant?.name ?? "—"}
              icon="tenant"
              sub={activeTenant?.slug ?? ""}
            />
          </>
        )}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Audit log */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Icons.logs className="w-4 h-4 text-primary" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            {loading ? (
              <div className="px-6 pb-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                No activity yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {auditLogs.map((log: any, i) => (
                  <li
                    key={log.id ?? i}
                    className="px-6 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <ActionLabel action={log.action} />
                      {log.metadata?.ip && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {log.metadata.ip}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {log.createdAt
                        ? formatDistanceToNow(new Date(log.createdAt), {
                            addSuffix: true,
                          })
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Active sessions */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Icons.shieldCheck className="w-4 h-4 text-primary" /> Active
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            {loading ? (
              <div className="px-6 pb-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                No sessions found.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {sessions.slice(0, 6).map((s: any, i) => (
                  <li
                    key={s.id ?? i}
                    className="px-6 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icons.monitor className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-foreground truncate">
                        {s.userAgent?.split(" ")[0] ?? "Unknown device"}
                      </span>
                    </div>
                    <StatusBadge
                      status={s.valid === false ? "REVOKED" : "ACTIVE"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
