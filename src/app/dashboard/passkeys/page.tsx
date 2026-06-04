"use client";
import { useEffect, useState } from "react";
import { identity as identityApi } from "@/lib/api";
import { Badge, Card, CardBody, Spinner, Alert, Button } from "@/components/ui";

export default function PasskeysPage() {
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    identityApi.listPasskeys()
      .then(r => setPasskeys(r.data ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Passkeys</h1>
          <p className="text-sm text-zinc-500 mt-1">WebAuthn biometric credentials registered on your account</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => alert("Open your browser WebAuthn API to register a new passkey.")}>
          + Add passkey
        </Button>
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="space-y-3">
        {passkeys.map((p: any) => (
          <Card key={p.id}>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-800">{p.name ?? "Unnamed passkey"}</p>
                <p className="text-xs text-zinc-400 mt-0.5">Type: {p.deviceType} · Last used {new Date(p.lastUsedAt).toLocaleDateString()}</p>
              </div>
              <Badge variant="success">Active</Badge>
            </CardBody>
          </Card>
        ))}
        {!loading && passkeys.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <div className="text-4xl mb-3">🔑</div>
            <p className="text-sm">No passkeys registered yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
