"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/api";
import { Badge, Card, CardBody, CardHeader, Spinner, Alert } from "@/components/ui";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    auth.getSessions()
      .then(r => setSessions(r.data ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Sessions</h1>
        <p className="text-sm text-zinc-500 mt-1">Active authentication sessions across your devices</p>
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="space-y-3">
        {sessions.map((s: any) => (
          <Card key={s.id}>
            <CardBody className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-800 truncate max-w-xs">{s.userAgent ?? "Unknown device"}</p>
                <p className="text-xs text-zinc-400 mt-0.5">IP: {s.ip ?? "—"} · Created {new Date(s.createdAt).toLocaleString()}</p>
                <p className="text-xs text-zinc-400">Expires {new Date(s.expiresAt).toLocaleString()}</p>
              </div>
              <Badge variant={s.valid ? "success" : "danger"}>{s.valid ? "Active" : "Expired"}</Badge>
            </CardBody>
          </Card>
        ))}
        {!loading && sessions.length === 0 && <p className="text-sm text-zinc-400">No active sessions.</p>}
      </div>
    </div>
  );
}
