// src/app/(dashboard)/settings/profile/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useStepUp } from "@/hooks/use-step-up";
import { identitySdk } from "@/sdk/identity.sdk";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StepUpDialog, ConfirmActionDialog } from "@/components/arc/dialogs";
import { Icons } from "@/lib/ui/icon-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";

export default function ProfilePage() {
  const router = useRouter();
  const { user, setTokens, clearAuth } = useAuth();
  const { isOpen, run, verify, cancel } = useStepUp();

  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/identity/profile`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("arcid:access_token") ?? ""}`,
        },
      },
    )
      .then((r) => r.json())
      .then((j) => setProfile(j.data))
      .catch(() => {});
  }, []);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (user?.primaryEmail?.[0]?.toUpperCase() ?? "?");

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);
    try {
      const updated = await identitySdk.updateProfile({
        name: name.trim() || undefined,
      });
      // Update local store user
      if (user) {
        setTokens(
          localStorage.getItem("arcid:access_token") ?? "",
          localStorage.getItem("arcid:refresh_token") ?? "",
          { ...user, name: updated.name ?? user.name },
        );
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await run(async () => {
      await identitySdk.deleteAccount();
      clearAuth();
      router.replace("/login");
    });
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader
        title="Profile"
        description="Manage your account details and preferences."
      />

      {/* Avatar + identity info */}
      <Card className="bg-card border-border">
        <CardContent className="p-6 flex items-center gap-5">
          <Avatar className="w-16 h-16">
            <AvatarFallback className="bg-primary/20 text-primary text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-base truncate">
              {user?.name ?? "—"}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {user?.primaryEmail}
            </p>
            <div className="mt-1.5">
              <StatusBadge status={user?.status ?? "ACTIVE"} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit name */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Display name</CardTitle>
          <CardDescription className="text-xs">
            This name appears across ArcID and any connected applications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {saveError && (
            <Alert
              variant="destructive"
              className="text-sm flex items-start gap-2"
            >
              <Icons.alertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{saveError}</span>
            </Alert>
          )}
          {saveSuccess && (
            <Alert className="text-sm flex items-start gap-2 border-emerald-500/30 bg-emerald-500/5">
              <Icons.success className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
              <span className="text-emerald-400">Profile updated.</span>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || name === user?.name}
          >
            {saving ? (
              <>
                <Icons.refresh className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Email (read-only) */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Email address</CardTitle>
          <CardDescription className="text-xs">
            Your primary email. Contact support to change it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Icons.mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {user?.primaryEmail}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Memberships */}
      {profile?.memberships?.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tenant memberships</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            <ul className="divide-y divide-border">
              {profile.memberships.map((m: any) => (
                <li
                  key={m.tenantId}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <span className="text-sm text-foreground font-mono text-xs">
                    {m.tenantId}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      <Card className="bg-card border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-destructive">
            Danger zone
          </CardTitle>
          <CardDescription className="text-xs">
            Permanently deletes your account, all sessions, and all associated
            data. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Icons.userX className="w-3.5 h-3.5 mr-1.5" />
            Delete my account
          </Button>
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete account?"
        description="This will permanently delete your identity, all sessions, tokens, and credentials. You will need to re-authenticate first."
        confirmLabel="Delete account"
        destructive
        onConfirm={handleDelete}
      />

      <StepUpDialog open={isOpen} onCancel={cancel} onVerify={verify} />
    </div>
  );
}
