"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { identity as identityApi } from "@/lib/api";
import { Button, Input, Alert, Card, CardHeader, CardBody, CardFooter } from "@/components/ui";

export default function ProfilePage() {
  const { identity, refresh } = useAuth();
  const [form, setForm] = useState({ name: "", picture: "" });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (identity) setForm({ name: identity.name ?? "", picture: identity.picture ?? "" });
  }, [identity]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      await identityApi.updateProfile(form);
      await refresh();
      setSuccess("Profile updated successfully.");
    } catch (err: any) {
      setError(err.message ?? "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Profile</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your identity information</p>
      </div>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Identity Details</h2></CardHeader>
        <CardBody className="space-y-1">
          <p className="text-xs text-zinc-400">ID</p>
          <p className="text-sm font-mono text-zinc-600">{identity?.id}</p>
          <p className="text-xs text-zinc-400 mt-2">Email</p>
          <p className="text-sm text-zinc-700">{identity?.primaryEmail} {identity?.emailVerified ? "✅" : "⚠️ unverified"}</p>
        </CardBody>
      </Card>

      <Card>
        <form onSubmit={handleSave}>
          <CardHeader><h2 className="text-sm font-semibold">Edit Profile</h2></CardHeader>
          <CardBody className="space-y-4">
            {success && <Alert variant="success">{success}</Alert>}
            {error && <Alert variant="error">{error}</Alert>}
            <Input label="Full name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <Input label="Picture URL" type="url" value={form.picture} onChange={e => setForm(p => ({ ...p, picture: e.target.value }))} />
          </CardBody>
          <CardFooter>
            <Button type="submit" loading={loading}>Save changes</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
