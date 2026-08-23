"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AccountSettingsPanel,
  Button,
  Input,
  Label,
  PasswordStrengthMeter,
  SecuritySectionCard,
} from "@arcevo/facet-components";
import { useAuthStore } from "@arcevo/facet-store";
import { useAuth } from "@arcevo/facet-auth";
import { PageShell } from "@/components/page-shell";
import { useProfile } from "@/hooks/use-profile";

interface SettingsSection {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

interface SecurityFeature {
  id: string;
  title: string;
  description: string;
  icon?: string;
  badge?: string;
}

const sections: SettingsSection[] = [
  { id: "profile", label: "Profile", icon: "user" },
  { id: "security", label: "Security", icon: "shield" },
  { id: "password", label: "Password", icon: "lock" },
];

const securityFeatures: SecurityFeature[] = [
  {
    id: "mfa",
    title: "Two-Factor Authentication",
    description: "Add an extra layer of security with TOTP apps.",
    icon: "lock",
  },
  {
    id: "passkeys",
    title: "Passkeys",
    description: "Manage WebAuthn passkeys for passwordless login.",
    icon: "key",
  },
  {
    id: "sessions",
    title: "Active Sessions",
    description: "Review and revoke logged-in devices.",
    icon: "monitor",
  },
  {
    id: "audit",
    title: "Audit Log",
    description: "Track security and access events.",
    icon: "scroll-text",
  },
];

const securityRoutes: Record<string, string> = {
  mfa: "/console/security/mfa",
  passkeys: "/console/security/passkeys",
  sessions: "/console/security/sessions",
  audit: "/console/security/audit",
};

export default function UserPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { updateProfile } = useProfile();
  const { changePassword } = useAuth();

  const [activeId, setActiveId] = useState("profile");
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaved(false);
    const result = await updateProfile({ name });
    if (!result.error) {
      setSaved(true);
      useAuthStore.getState().setUser(result.data ?? user!);
    }
    setSaving(false);
  };

  const handleSavePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    const result = await changePassword(currentPassword, newPassword);
    if (result.error) {
      setPasswordError(result.error.message);
    } else {
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const content = {
    profile: (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={user?.email ?? ""}
            disabled
            className="max-w-md"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-md"
          />
        </div>
        {saved && <p className="text-sm text-emerald-600">Profile updated.</p>}
        <Button onClick={handleSaveProfile} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    ),
    security: (
      <SecuritySectionCard
        features={securityFeatures}
        onSelect={(feature) => {
          const route = securityRoutes[feature.id];
          if (route) router.push(route);
        }}
        columns={2}
      />
    ),
    password: (
      <div className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="current-password">Current Password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          {newPassword && <PasswordStrengthMeter value={newPassword} showRules />}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {passwordError && (
          <p className="text-sm text-destructive">{passwordError}</p>
        )}
        {passwordSuccess && (
          <p className="text-sm text-emerald-600">Password changed.</p>
        )}
        <Button
          onClick={handleSavePassword}
          disabled={!newPassword || !currentPassword}
        >
          Change Password
        </Button>
      </div>
    ),
  };

  return (
    <PageShell
      title="Account Settings"
      description="Manage your profile, security, and password."
      card={false}
    >
      <AccountSettingsPanel
        sections={sections}
        content={content}
        activeId={activeId}
        onActiveChange={setActiveId}
      />
    </PageShell>
  );
}
