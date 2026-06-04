"use client";
import { useEffect, useState } from "react";
import { audit } from "@/lib/api";
import { Badge, Card, CardBody, Spinner, Alert, Button } from "@/components/ui";

const ACTION_COLORS: Record<string, "default"|"success"|"danger"|"warning"|"info"> = {
  USER_LOGIN_SUCCESS: "success",
  USER_LOGIN_FAILED: "danger",
  USER_REGISTERED: "info",
  MFA_ENABLED: "success",
  MFA_DISABLED: "warning",
  TOKEN_REVOKED: "warning",
  CREDENTIAL_ISSUED: "info",
  CREDENTIAL_REVOKED: "danger",
  SESSION_CREATED: "success",
  SESSION_REVOKED: "warning",
  PASSKEY_REGISTERED: "success",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => { load(); }, [page, actionFilter]);

  async function load() {
    setLoading(true);
    try {
      const r = await audit.getLogs({ limit: 20, page, action: actionFilter || undefined });
      setLogs(r.data ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Audit Logs</h1>
        <p className="text-sm text-zinc-500 mt-1">Immutable record of all system events</p>
      </div>

      <div className="flex gap-3 items-center">
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white">
          <option value="">All actions</option>
          {Object.keys(ACTION_COLORS).map(a => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      <div className="space-y-2">
        {logs.map((log: any, i: number) => (
          <Card key={i}>
            <CardBody className="flex items-start justify-between gap-4 py-3">
              <div className="flex items-start gap-3">
                <Badge variant={ACTION_COLORS[log.action] ?? "default"}>
                  {log.action?.replace(/_/g, " ")}
                </Badge>
                <div>
                  {log.ip && <p className="text-xs text-zinc-400">IP: {log.ip}</p>}
                  {log.identityId && <p className="text-xs text-zinc-400 font-mono">User: {log.identityId}</p>}
                </div>
              </div>
              <span className="text-xs text-zinc-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</span>
            </CardBody>
          </Card>
        ))}
        {!loading && logs.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm">No audit logs found.</p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</Button>
        <span className="text-sm text-zinc-500">Page {page}</span>
        <Button variant="secondary" size="sm" disabled={logs.length < 20} onClick={() => setPage(p => p + 1)}>Next →</Button>
      </div>
    </div>
  );
}
