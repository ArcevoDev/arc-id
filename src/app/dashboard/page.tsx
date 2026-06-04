"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { billing, audit } from "@/lib/api";
import { Card, CardBody, Badge } from "@/components/ui";

export default function DashboardHome() {
  const { identity } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    billing.getSubscription().then(r => setSubscription(r.data)).catch(() => {});
    audit.getLogs({ limit: 5 }).then(r => setRecentLogs(r.data ?? [])).catch(() => {});
  }, []);

  const planColor: Record<string, "default"|"info"|"success"> = {
    FREE: "default", PRO: "info", ENTERPRISE: "success"
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Welcome back{identity?.name ? `, ${identity.name}` : ""}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">ArcID Identity Control Panel</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Status</p>
            <Badge variant={identity?.status === "ACTIVE" ? "success" : "warning"}>{identity?.status ?? "—"}</Badge>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Plan</p>
            <Badge variant={planColor[subscription?.plan] ?? "default"}>{subscription?.plan ?? "FREE"}</Badge>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Email</p>
            <p className="text-sm font-medium text-zinc-700 truncate">
              {identity?.emailVerified ? "✅" : "⚠️"} {identity?.primaryEmail ?? "—"}
            </p>
          </CardBody>
        </Card>
      </div>

      {recentLogs.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-zinc-800 mb-3">Recent Activity</h3>
            <ul className="space-y-2">
              {recentLogs.map((log: any, i: number) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">{log.action?.replace(/_/g, " ")}</span>
                  <span className="text-xs text-zinc-400">{new Date(log.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
