"use client";
import { useEffect, useState } from "react";
import { admin, billing } from "@/lib/api";
import { Button, Badge, Card, CardBody, CardHeader, Spinner, Alert, Modal, Input } from "@/components/ui";

export default function AdminPage() {
  const [identities, setIdentities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPlan, setShowPlan] = useState(false);
  const [planForm, setPlanForm] = useState({ tenantId: "", plan: "PRO" as "FREE"|"PRO"|"ENTERPRISE" });
  const [planMsg, setPlanMsg] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await admin.listIdentities({ limit: 20 });
      setIdentities(r.data ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleSuspend(id: string) {
    if (!confirm("Suspend this identity?")) return;
    try {
      await admin.suspendIdentity(id);
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function handleSetPlan(e: React.FormEvent) {
    e.preventDefault();
    try {
      await billing.setPlan({ tenantId: planForm.tenantId || undefined, plan: planForm.plan });
      setPlanMsg("Plan updated!");
    } catch (e: any) { setPlanMsg("Error: " + e.message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Admin Panel</h1>
          <p className="text-sm text-zinc-500 mt-1">Identity management and system administration</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowPlan(true)}>⚙️ Set tenant plan</Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">All Identities</h2>
        </CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {identities.map((id: any) => (
                <div key={id.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{id.name ?? "—"}</p>
                    <p className="text-xs text-zinc-400">{id.primaryEmail}</p>
                    <p className="text-xs font-mono text-zinc-300">{id.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={
                      id.status === "ACTIVE" ? "success" :
                      id.status === "SUSPENDED" ? "danger" :
                      id.status === "PENDING" ? "warning" : "default"
                    }>{id.status}</Badge>
                    {id.status === "ACTIVE" && (
                      <Button variant="danger" size="sm" onClick={() => handleSuspend(id.id)}>Suspend</Button>
                    )}
                  </div>
                </div>
              ))}
              {!loading && identities.length === 0 && (
                <div className="text-center py-8 text-zinc-400 text-sm">No identities found.</div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal open={showPlan} onClose={() => { setShowPlan(false); setPlanMsg(""); }} title="Set Tenant Plan (Admin)">
        <form onSubmit={handleSetPlan} className="space-y-4">
          {planMsg && <Alert variant={planMsg.startsWith("Error") ? "error" : "success"}>{planMsg}</Alert>}
          <Input label="Tenant ID (leave empty for SYSTEM)" value={planForm.tenantId} onChange={e => setPlanForm(p => ({ ...p, tenantId: e.target.value }))} placeholder="SYSTEM" />
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1">Plan</label>
            <select value={planForm.plan} onChange={e => setPlanForm(p => ({ ...p, plan: e.target.value as any }))}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm">
              <option value="FREE">FREE</option>
              <option value="PRO">PRO</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setShowPlan(false)}>Cancel</Button>
            <Button type="submit">Apply</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
