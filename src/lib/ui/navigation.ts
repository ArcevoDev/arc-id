// src/lib/ui/navigation.ts
//
// Single source of truth for sidebar navigation.
// The Sidebar component imports from here — never defines its own NAV array.
// Groups let you add section headers when the sidebar is expanded.
// Each item's `icon` is a key from the Icons registry — import the component
// at the usage site: const Icon = Icons[item.icon]

import type { IconName } from "./icon-registry";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  badge?: string; // optional count/label shown on the chip
}

export interface NavGroup {
  title?: string; // undefined = no heading rendered
  items: NavItem[];
}

export const navigationGroups: NavGroup[] = [
  {
    items: [{ label: "Overview", href: "/dashboard", icon: "barChart" }],
  },
  {
    title: "Identity",
    items: [
      { label: "Identities", href: "/identities", icon: "users" },
      { label: "Credentials", href: "/credentials", icon: "credential" },
      { label: "Tenants", href: "/tenants", icon: "tenant" },
    ],
  },
  {
    title: "Developer",
    items: [
      { label: "OAuth Apps", href: "/oauth/applications", icon: "key" },
      { label: "API Keys", href: "/developer/api-keys", icon: "code" },
      { label: "Webhooks", href: "/developer/webhooks", icon: "send" },
    ],
  },
  {
    title: "Security",
    items: [
      { label: "Sessions", href: "/security/sessions", icon: "shieldCheck" },
      { label: "MFA", href: "/security/mfa", icon: "lock" },
      { label: "Passkeys", href: "/security/passkeys", icon: "passkey" },
      { label: "Audit Log", href: "/security/audit", icon: "logs" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Billing", href: "/billing", icon: "billing" },
      { label: "Settings", href: "/settings/profile", icon: "settings" },
    ],
  },
];
