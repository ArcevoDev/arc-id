"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useProfile } from "@/hooks/use-profile";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@arcevo/facet-components";

export default function UserProfilePage() {
  const user = useAuthStore((s) => s.user);
  const { updateProfile } = useProfile();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
      if (user) useAuthStore.getState().setUser({ ...user, name });
    } else {
      setError(result.error?.message ?? "Failed to update profile");
    }
  };

  return (
    <div className="space-y-6">
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
            <Input id="email" disabled value={user?.email ?? ""} />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
            {saved && <span className="text-sm text-emerald-600">Saved</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
