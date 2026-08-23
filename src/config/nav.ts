/**
 * ArcID Navigation Configuration
 *
 * Single source of truth for the sidebar nav tree.
 * The facet-ConsoleLayout's Sidebar reads this - not hardcoded JSX.
 *
 * Permission gating (requiredPermission) is defined here but
 * is NOT enforced in v1. All nav items are shown to authenticated
 * users. The backend is the real enforcement boundary.
 */

import type { IconName } from "@arcevo/facet-components";

export interface NavItem {
  /** Full route path e.g. "/console/security/sessions" */
  href: string;
  /** Display label */
  label: string;
  /** Icon name from the icon registry */
  icon: IconName;
  /** Optional RBAC permission string - reserved for future gating */
  requiredPermission?: string;
  /** Sub-items (rendered as collapsible group in sidebar) */
  children?: NavItem[];
}

export interface NavSection {
  /** Section heading in the sidebar */
  title: string;
  /** Items in this section */
  items: NavItem[];
}

export const navConfig: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/console", label: "Dashboard", icon: "chart-column" }],
  },
  {
    title: "Identity",
    items: [
      { href: "/console/admin", label: "Admin", icon: "shield", requiredPermission: "admin:system" },
      { href: "/console/identities", label: "Identities", icon: "users", requiredPermission: "admin:system" },
      { href: "/console/tenants", label: "Tenants", icon: "building-2" },
      { href: "/console/organization/members", label: "Members", icon: "badge-check" },
    ],
  },
  {
    title: "Billing",
    items: [{ href: "/console/billing", label: "Billing", icon: "credit-card" }],
  },
  {
    title: "Credentials",
    items: [{ href: "/console/credentials", label: "Credentials", icon: "file-check" }],
  },
  {
    title: "Security",
    items: [
      { href: "/console/security/sessions", label: "Sessions", icon: "monitor" },
      { href: "/console/security/passkeys", label: "Passkeys", icon: "key" },
      { href: "/console/security/mfa", label: "Two-Factor", icon: "lock" },
      { href: "/console/security/audit", label: "Audit Log", icon: "scroll-text", requiredPermission: "audit:read:any" },
    ],
  },
  {
    title: "Developers",
    items: [
      {
        href: "/console/oauth/applications",
        label: "OAuth Applications",
        icon: "globe",
      },
      { href: "/console/oauth/tokens", label: "OAuth Tokens", icon: "key" },
      { href: "/console/webhooks", label: "Webhooks", icon: "send" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/console/user", label: "Account", icon: "user" },
    ],
  },
];
