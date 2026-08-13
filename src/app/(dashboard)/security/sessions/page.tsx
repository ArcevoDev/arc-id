"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useSessions } from "@/hooks/use-sessions";
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@arcevo/facet-components";
import type { Session } from "@arcevo/facet-sdk";

export default function SessionsPage() {
  const { list, revoke } = useSessions();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await list();
    if (result.data) setSessions(result.data);
    else setError(result.error?.message ?? "Failed to load sessions");
  }, [list]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    const result = await revoke(sessionId);
    setRevokingId(null);
    if (result.data) {
      setSessions((prev) => prev?.filter((s) => s.id !== sessionId) ?? null);
    } else {
      setError(result.error?.message ?? "Failed to revoke session");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions"
        description="Manage your active login sessions"
        actions={
          <Button variant="secondary" size="sm" onClick={load}>
            Refresh
          </Button>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Device</TableHead>
            <TableHead>Auth level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last active</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions === null ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={5}>
                Loading sessions…
              </TableCell>
            </TableRow>
          ) : sessions.length === 0 ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={5}>
                No active sessions.
              </TableCell>
            </TableRow>
          ) : (
            sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.userAgent ?? "Unknown device"}</TableCell>
                <TableCell>
                  <Badge variant={s.authLevel === "aal2" ? "success" : "outline"}>
                    {s.authLevel === "aal2" ? "MFA" : "Password"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={s.valid === false ? "destructive" : "default"}>
                    {s.valid === false ? "Revoked" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString() : "-"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={revokingId === s.id || s.valid === false}
                    onClick={() => handleRevoke(s.id)}
                  >
                    {revokingId === s.id ? "Revoking…" : "Revoke"}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
