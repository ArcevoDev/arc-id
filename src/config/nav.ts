/**
 * ArcID Navigation Configuration
 *
 * Single source of truth for the sidebar nav tree.
 * The Sidebar component reads this — not hardcoded JSX.
 *
 * Permission gating (requiredPermission) is defined here but
 * is NOT enforced in v1. All nav items are shown to authenticated
 * users. The backend is the real enforcement boundary.
 *
 * When GET /auth/me/permissions exists, set requiredPermission
 * and filter in the Sidebar.
 */

import type { IconName } from "@arcevo/facet-components";

export interface NavItem {
  /** Full route path e.g. "/security/sessions" */
  href: string;
  /** Display label */
  label: string;
  /** Icon name from the icon registry */
  icon: IconName;
  /** Optional RBAC permission string — reserved for future gating */
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
    items: [{ href: "/dashboard", label: "Dashboard", icon: "chart-column" }],
  },
  {
    title: "Identity",
    items: [
      { href: "/admin", label: "Admin", icon: "shield", requiredPermission: "admin:system" },
      { href: "/identities", label: "Identities", icon: "users", requiredPermission: "admin:system" },
      { href: "/tenants", label: "Tenants", icon: "building-2" },
    ],
  },
  {
    title: "Billing",
    items: [{ href: "/billing", label: "Billing", icon: "credit-card" }],
  },
  {
    title: "Credentials",
    items: [{ href: "/credentials", label: "Credentials", icon: "file-check" }],
  },
  {
    title: "Security",
    items: [
      { href: "/security/sessions", label: "Sessions", icon: "monitor" },
      { href: "/security/passkeys", label: "Passkeys", icon: "key" },
      { href: "/security/mfa", label: "Two-Factor", icon: "lock" },
      { href: "/security/audit", label: "Audit Log", icon: "scroll-text", requiredPermission: "audit:read:any" },
    ],
  },
  {
    title: "Developers",
    items: [
      {
        href: "/oauth/applications",
        label: "OAuth Applications",
        icon: "globe",
      },
      { href: "/oauth/tokens", label: "OAuth Tokens", icon: "key" },
      { href: "/developer/api-keys", label: "API Keys", icon: "code" },
      { href: "/developer/webhooks", label: "Webhooks", icon: "send" },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/settings/profile", label: "Profile", icon: "user" }],
  },
];
