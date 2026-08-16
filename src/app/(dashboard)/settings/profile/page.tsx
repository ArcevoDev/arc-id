"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@arcevo/facet-layout";
import { useAuthStore } from "@/store/auth.store";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@arcevo/facet-components";

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { updateProfile, deleteAccount } = useProfile();
  const { clearSession } = useAuth();
  const [name, setName] = useState("");
  const [email] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateProfile({ name });
    setSaving(false);
    if (result.data) {
      setSaved(true);
      // Keep the store's user in sync with the saved name.
      if (user) useAuthStore.getState().setUser({ ...user, name });
    } else {
      setError(result.error?.message ?? "Failed to update profile");
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError(null);
    const result = await deleteAccount();
    setSaving(false);
    if (!result.error) {
      clearSession();
      router.replace("/login");
    } else {
      setError(result.error?.message ?? "Failed to delete account");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Profile" description="Manage your account settings" />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Personal information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" disabled value={email} />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {saved && <span className="text-sm text-emerald-600">Saved</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data.
          </p>
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-destructive">Are you sure?</span>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
                Yes, delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete account
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
