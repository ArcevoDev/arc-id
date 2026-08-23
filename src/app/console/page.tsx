"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ActivityFeed, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@arcevo/facet-components";
import { StatCard, PageHeader } from "@arcevo/facet-components";
import { useAuthStore, useTenantStore } from "@arcevo/facet-store";
import { useRouter } from "next/navigation";
import { useCredentials } from "@/hooks/use-credentials";
import { useSessions } from "@/hooks/use-sessions";
import { useOAuth } from "@/hooks/use-oauth";
import { useIdentities } from "@/hooks/use-identities";
import { useAuditLog } from "@/hooks/use-audit-log";

const quickActions = [
  { label: "Credentials", href: "/console/credentials", desc: "Issue, verify, and manage verifiable credentials" },
  { label: "Sessions", href: "/console/security/sessions", desc: "View and revoke active sessions" },
  { label: "Passkeys", href: "/console/security/passkeys", desc: "Manage your WebAuthn passkeys" },
  { label: "MFA", href: "/console/security/mfa", desc: "Configure multi-factor authentication" },
];

interface AuditEvent {
  id: string;
  action: string;
  targetType?: string;
  createdAt: string;
}

export default function ConsoleDashboardPage() {
  const { user, accessToken } = useAuthStore();
  const { activeTenant } = useTenantStore();
  const router = useRouter();
  const { list: listCredentials } = useCredentials();
  const { list: listSessions } = useSessions();
  const { listClients } = useOAuth();
  const { list: listIdentities } = useIdentities();
  const { list: listAudit } = useAuditLog();

  const [statCreds, setStatCreds] = useState(0);
  const [statSessions, setStatSessions] = useState(0);
  const [statClients, setStatClients] = useState(0);
  const [statIdentities, setStatIdentities] = useState(0);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    if (!accessToken) router.replace("/login");
  }, [accessToken, router]);

  useEffect(() => {
    if (!activeTenant || !accessToken) return;

    async function load() {
      const [creds, sessions, clients, identities, audit] = await Promise.allSettled([
        listCredentials(),
        listSessions(),
        listClients(),
        listIdentities(),
        listAudit({ limit: 10 }),
      ]);

      setStatCreds(creds.status === "fulfilled" ? (creds.value.data as unknown[] | null)?.length ?? 0 : 0);
      setStatSessions(sessions.status === "fulfilled" ? (sessions.value.data as unknown[] | null)?.length ?? 0 : 0);
      setStatClients(clients.status === "fulfilled" ? (clients.value.data as unknown[] | null)?.length ?? 0 : 0);
      setStatIdentities(identities.status === "fulfilled" && identities.value.data
        ? (identities.value.data as { meta: { total: number } })?.meta?.total ?? 0 : 0);

      if (audit.status === "fulfilled" && audit.value.data) {
        setEvents((audit.value.data as { data: AuditEvent[] })?.data ?? []);
      }

      setLoading(false);
    }

    void load();
  }, [activeTenant, accessToken, listCredentials, listSessions, listClients, listIdentities, listAudit]);

  if (!accessToken) return null;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name ?? "there"}`}
        description={activeTenant ? `${activeTenant.name} Console` : "Select a tenant to get started"}
      />
      <main className="p-6">
        {!activeTenant && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>No workspace selected</CardTitle>
              <CardDescription>Select or create a tenant to begin.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild><Link href="/console/tenants">Manage Tenants</Link></Button>
            </CardContent>
          </Card>
        )}

        {activeTenant && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <StatCard label="Credentials" value={statCreds} icon="file-check" hint="Issued to this tenant" />
              <StatCard label="Active Sessions" value={statSessions} icon="monitor" hint="Devices logged in" />
              <StatCard label="OAuth Clients" value={statClients} icon="globe" hint="Registered apps" />
              <StatCard label="Identities" value={statIdentities} icon="users" hint="In this tenant" />
            </div>

            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
              {quickActions.map((a) => (
                <Link key={a.href} href={a.href}>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader>
                      <CardTitle>{a.label}</CardTitle>
                      <CardDescription>{a.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest audit events for this tenant.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground">Loading activity...</p>
                ) : (
                  <ActivityFeed
                    items={events.map((e) => ({
                      id: e.id,
                      title: e.action,
                      description: e.targetType,
                      timestamp: e.createdAt,
                    }))}
                    groupByDay={false}
                    emptyText="No recent activity."
                  />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
