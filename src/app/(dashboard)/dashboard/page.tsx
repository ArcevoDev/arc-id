"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useSessions } from "@/hooks/use-sessions";
import { Icons } from "@/lib/ui/icon-registry";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const { list: listSessions } = useSessions();
  const [sessionCount, setSessionCount] = useState<number | null>(null);

  useEffect(() => {
    listSessions().then((res) => {
      if (res.data && Array.isArray(res.data)) {
        setSessionCount(res.data.length);
      }
    });
  }, [listSessions]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Loading..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome${user?.name ? `, ${user.name}` : ""}`}
        description="Overview of your identity workspace"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 space-y-2">
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="text-2xl font-semibold">{'\u2014'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-2">
            <p className="text-xs text-muted-foreground">Active sessions</p>
            <p className="text-2xl font-semibold">
              {sessionCount !== null ? sessionCount : '\u2014'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-2">
            <p className="text-xs text-muted-foreground">Recent events</p>
            <p className="text-2xl font-semibold">{'\u2014'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-2">
            <p className="text-xs text-muted-foreground">Workspace</p>
            <p className="text-2xl font-semibold">{'\u2014'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Icons.logs className="h-4 w-4 text-primary" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Activity feed loading...</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Icons.shieldCheck className="h-4 w-4 text-primary" /> Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {sessionCount !== null
                ? `${sessionCount} active session${sessionCount === 1 ? "" : "s"}`
                : "Sessions loading..."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
