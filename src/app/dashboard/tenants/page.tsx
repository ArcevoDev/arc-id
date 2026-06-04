"use client";
import { useEffect, useState } from "react";
import { tenant as tenantApi } from "@/lib/api";
import { Button, Badge, Card, CardBody, Spinner, Alert, Modal, Input } from "@/components/ui";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", sector: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await tenantApi.list();
      setTenants(r.data ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setCreating(true);
    try {
      await tenantApi.create(form);
      setShowCreate(false);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Tenants</h1>
          <p className="text-sm text-zinc-500 mt-1">Multi-tenant organisation management</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">+ New tenant</Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      <div className="grid gap-4">
        {tenants.map((t: any) => (
          <Card key={t.id}>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-800">{t.name}</p>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">{t.slug}</p>
                {t.sector && <p className="text-xs text-zinc-400 mt-0.5">Sector: {t.sector}</p>}
              </div>
              <Badge>{t.id === "SYSTEM" ? "System" : "Custom"}</Badge>
            </CardBody>
          </Card>
        ))}
        {!loading && tenants.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <div className="text-4xl mb-3">🏢</div>
            <p className="text-sm">No tenants yet.</p>
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Tenant">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          <Input label="Slug" value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} required hint="Used in URLs — no spaces" />
          <Input label="Sector" value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>Create tenant</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
