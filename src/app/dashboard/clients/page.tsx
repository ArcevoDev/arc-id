"use client";
import { useEffect, useState } from "react";
import { oauth } from "@/lib/api";
import { Button, Badge, Card, CardBody, CardHeader, Spinner, Alert, Modal, Input } from "@/components/ui";

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", public: false, redirectUris: "" });
  const [newClient, setNewClient] = useState<any>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await oauth.listClients();
      setClients(r.data ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await oauth.createClient({
        name: form.name,
        public: form.public,
        redirectUris: form.redirectUris.split("\n").map(s => s.trim()).filter(Boolean),
      });
      setNewClient(res.data);
      setShowCreate(false);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">OAuth Clients</h1>
          <p className="text-sm text-zinc-500 mt-1">Registered applications consuming ArcID identity services</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">+ New client</Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {newClient && (
        <Alert variant="success" title="Client created!">
          <p>Client ID: <code className="font-mono">{newClient.clientId}</code></p>
          {newClient.clientSecret && <p className="mt-1">Secret (save now — not shown again): <code className="font-mono text-xs break-all">{newClient.clientSecret}</code></p>}
        </Alert>
      )}

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      <div className="grid gap-4">
        {clients.map((c: any) => (
          <Card key={c.id ?? c.clientId}>
            <CardBody className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-zinc-800">{c.name}</p>
                <p className="text-xs font-mono text-zinc-400 mt-0.5">{c.clientId}</p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {(c.grantTypes ?? []).map((g: string) => <Badge key={g}>{g}</Badge>)}
                </div>
              </div>
              <Badge variant={c.public ? "info" : "default"}>{c.public ? "Public" : "Confidential"}</Badge>
            </CardBody>
          </Card>
        ))}
        {!loading && clients.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <div className="text-4xl mb-3">🔌</div>
            <p className="text-sm">No clients registered yet.</p>
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create OAuth Client">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Application name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1">Redirect URIs (one per line)</label>
            <textarea value={form.redirectUris} onChange={e => setForm(p => ({ ...p, redirectUris: e.target.value }))}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm min-h-[80px]" placeholder="https://app.example.com/callback" />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={form.public} onChange={e => setForm(p => ({ ...p, public: e.target.checked }))} />
            Public client (no client secret)
          </label>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
