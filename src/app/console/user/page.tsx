"use client";

import { useState } from "react";
import { PageHeader } from "@arcevo/facet-layout";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@arcevo/facet-components";
import { useAuthStore } from "@arcevo/facet-store";
import { useProfile } from "@/hooks/use-profile";

export default function UserPage() {
  const { user } = useAuthStore();
  const { updateProfile } = useProfile();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const result = await updateProfile({ name });
    if (!result.error) {
      setSaved(true);
      useAuthStore.getState().setUser(result.data ?? user!);
    }
    setSaving(false);
  };

  return (
    <>
      <PageHeader title="Profile" description="Your account details." />
      <main className="p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your profile information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email ?? ""}
                disabled
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
              />
            </div>
            {saved && (
              <p className="text-sm text-emerald-600">Profile updated.</p>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
