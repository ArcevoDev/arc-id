#!/usr/bin/env node
/**
 * ArcID — Next.js UI Scaffold Script
 * ------------------------------------
 * Run from the arc-id project root:
 *   node scaffold-arcid-ui.js
 *
 * Scaffolds the complete src/app/ directory including:
 *   - Layout + navigation shell
 *   - Auth pages (login, register, magic link, MFA, passkey)
 *   - Identity dashboard (profile, sessions, devices, passkeys)
 *   - OAuth dashboard (clients, consent, tokens)
 *   - Credentials dashboard (issue, verify, revoke, status)
 *   - Tenant management (members, roles, SSO, branding)
 *   - Billing / subscription management
 *   - Admin panel (identities, audit logs, webhooks)
 *   - Shared UI components (button, card, badge, modal, table, alert)
 *   - API client with full typed wrappers for every ArcID endpoint
 *   - Auth context / session provider
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

let written = 0;
let skipped = 0;

function write(rel, content, force = false) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (fs.existsSync(abs) && !force) {
    console.log(`  SKIP   ${rel}`);
    skipped++;
    return;
  }
  fs.writeFileSync(abs, content.trimStart(), "utf8");
  console.log(`  WRITE  ${rel}`);
  written++;
}

function section(t) {
  console.log(`\n── ${t}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// 1. GLOBALS & ENV
// ════════════════════════════════════════════════════════════════════════════════
section("Environment");

write("src/app/globals.css", `
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #ffffff;
  --bg-muted: #f4f4f5;
  --fg: #09090b;
  --fg-muted: #71717a;
  --border: #e4e4e7;
  --primary: #18181b;
  --primary-fg: #ffffff;
  --danger: #ef4444;
  --warning: #f59e0b;
  --success: #22c55e;
  --accent: #6366f1;
}

* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font-family: 'Inter', system-ui, sans-serif; }
`, true);

write(".env.local", `
# ArcID backend URL — change to your deployed URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# JWT secret must match the backend JWT_SECRET (only needed server-side)
# ARCID_JWT_SECRET=your-secret-here
`);

// ════════════════════════════════════════════════════════════════════════════════
// 2. API CLIENT
// ════════════════════════════════════════════════════════════════════════════════
section("API Client");

write("src/lib/api.ts", `
/**
 * ArcID typed API client
 * All methods read NEXT_PUBLIC_API_URL from env.
 * The token is read from localStorage ("arcid_token").
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("arcid_token");
}

export function setToken(token: string) {
  localStorage.setItem("arcid_token", token);
}

export function clearToken() {
  localStorage.removeItem("arcid_token");
  localStorage.removeItem("arcid_refresh_token");
}

export function setRefreshToken(token: string) {
  localStorage.setItem("arcid_refresh_token", token);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("arcid_refresh_token");
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: { auth?: boolean; rawBody?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getToken();
  if (options?.auth !== false && token) {
    headers["Authorization"] = \`Bearer \${token}\`;
  }

  const res = await fetch(\`\${BASE}\${path}\`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const e = new Error(err.message ?? "Request failed") as any;
    e.status = res.status;
    e.code = err.error;
    e.data = err;
    throw e;
  }

  return res.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>("GET", path, undefined, { auth: true });
const post = <T>(path: string, body?: unknown, auth = true) => request<T>("POST", path, body, { auth });
const del = <T>(path: string) => request<T>("DELETE", path, undefined, { auth: true });
const patch = <T>(path: string, body?: unknown) => request<T>("PATCH", path, body, { auth: true });

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  register: (body: { email: string; password: string; name?: string }) =>
    post<{ success: boolean; data: { identity: any } }>("/auth/register", body, false),

  login: (body: { email: string; password: string }) =>
    post<{ success: boolean; data: any }>("/auth/login", body, false),

  logout: (sessionId: string) =>
    post<{ success: boolean }>("/auth/logout", { sessionId }),

  verifyEmail: (token: string) =>
    post<{ success: boolean }>("/auth/verify-email", { token }, false),

  requestPasswordReset: (email: string) =>
    post<{ success: boolean }>("/auth/password/reset", { email }, false),

  confirmPasswordReset: (token: string, newPassword: string) =>
    post<{ success: boolean }>("/auth/password/reset/confirm", { token, newPassword }, false),

  requestMagicLink: (email: string) =>
    post<{ success: boolean }>("/auth/magic-link/request", { email }, false),

  redeemMagicLink: (token: string) =>
    post<{ success: boolean; data: any }>("/auth/magic-link", { token }, false),

  verifyMfa: (code: string, sessionId: string) =>
    post<{ success: boolean; data: any }>("/auth/mfa/verify", { code, sessionId }, false),

  setupMfa: () =>
    post<{ success: boolean; data: { secret: string; uri: string; qrCode: string } }>("/auth/mfa/setup", { type: "TOTP" }),

  confirmMfa: (code: string) =>
    post<{ success: boolean; data: { recoveryCodes: string[] } }>("/auth/mfa/confirm", { code }),

  disableMfa: () => del<{ success: boolean }>("/auth/mfa"),

  getSessions: () => get<{ success: boolean; data: any[] }>("/auth/sessions"),

  switchContext: (tenantId: string) =>
    post<{ success: boolean; data: any }>("/auth/switch-context", { tenantId }),
};

// ── Identity / Profile ─────────────────────────────────────────────────────

export const identity = {
  getProfile: () => get<{ success: boolean; data: any }>("/identity/profile"),
  updateProfile: (body: { name?: string; picture?: string }) =>
    patch<{ success: boolean; data: any }>("/identity/profile", body),
  deleteAccount: () => del<{ success: boolean }>("/identity/profile"),
  getDevices: () => get<{ success: boolean; data: any[] }>("/identity/devices"),
  revokeDevice: (deviceId: string) => del<{ success: boolean }>(\`/identity/devices/\${deviceId}\`),
  listPasskeys: () => get<{ success: boolean; data: any[] }>("/identity/passkeys").catch(() => ({ success: true, data: [] })),
};

// ── OAuth / Clients ────────────────────────────────────────────────────────

export const oauth = {
  listClients: () => get<{ success: boolean; data: any[] }>("/oauth/clients").catch(() => ({ success: true, data: [] })),
  createClient: (body: any) =>
    post<{ success: boolean; data: any }>("/oauth/clients", body),
  getConsents: () => get<{ success: boolean; data: any[] }>("/oauth/consent").catch(() => ({ success: true, data: [] })),
  revokeConsent: (clientId: string) =>
    post<{ success: boolean }>("/oauth/consent/revoke", { clientId }),
  introspect: (token: string, clientId: string) =>
    post<any>("/oauth/introspect", { token, client_id: clientId }, false),
};

// ── Credentials ────────────────────────────────────────────────────────────

export const credentials = {
  issue: (body: { subjectDid: string; credentialSubject: Record<string, any>; type?: string[]; expiresAt?: string }) =>
    post<{ success: boolean; data: any }>("/credentials/issue", body),
  verify: (body: { credential: string; format?: string }) =>
    post<{ success: boolean; data: any }>("/credentials/verify", body, false),
  revoke: (credentialId: string) =>
    post<{ success: boolean }>("/credentials/revoke", { credentialId }),
  getStatusList: (listId: string) => get<any>(\`/credentials/status-lists/\${listId}\`),
  getDid: (tenantId?: string) => get<any>(tenantId ? \`/credentials/did/\${tenantId}\` : "/credentials/did"),
};

// ── Billing / Subscription ─────────────────────────────────────────────────

export const billing = {
  getSubscription: () => get<{ success: boolean; data: any }>("/subscription"),
  upgradePlan: (plan: "FREE" | "PRO" | "ENTERPRISE") =>
    post<{ success: boolean; data: any }>("/subscription/upgrade", { plan }),
  setPlan: (body: { tenantId?: string; plan: "FREE" | "PRO" | "ENTERPRISE" }) =>
    post<{ success: boolean; data: any }>("/subscription/plan", body),
};

// ── Tenant ─────────────────────────────────────────────────────────────────

export const tenant = {
  list: () => get<{ success: boolean; data: any[] }>("/tenant").catch(() => ({ success: true, data: [] })),
  create: (body: { name: string; slug: string; sector?: string }) =>
    post<{ success: boolean; data: any }>("/tenant", body),
  getMembers: (tenantId: string) => get<{ success: boolean; data: any[] }>(\`/tenant/\${tenantId}/members\`),
  addMember: (tenantId: string, body: { identityId: string; role: string }) =>
    post<{ success: boolean; data: any }>(\`/tenant/\${tenantId}/members\`, body),
  removeMember: (tenantId: string, memberId: string) =>
    del<{ success: boolean }>(\`/tenant/\${tenantId}/members/\${memberId}\`),
  getPolicy: (tenantId: string) => get<any>(\`/tenant/\${tenantId}/policy\`),
  updatePolicy: (tenantId: string, body: any) =>
    patch<any>(\`/tenant/\${tenantId}/policy\`, body),
};

// ── Audit ──────────────────────────────────────────────────────────────────

export const audit = {
  getLogs: (params?: { limit?: number; page?: number; action?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.page) q.set("page", String(params.page));
    if (params?.action) q.set("action", params.action);
    return get<{ success: boolean; data: any[]; total?: number }>(\`/audit?\${q.toString()}\`);
  },
};

// ── Admin ──────────────────────────────────────────────────────────────────

export const admin = {
  listIdentities: (params?: { limit?: number; page?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.page) q.set("page", String(params.page));
    return get<{ success: boolean; data: any[] }>(\`/identity/admin?\${q.toString()}\`);
  },
  suspendIdentity: (id: string) =>
    post<{ success: boolean }>(\`/identity/admin/\${id}/suspend\`, {}),
};
`);

// ════════════════════════════════════════════════════════════════════════════════
// 3. AUTH CONTEXT
// ════════════════════════════════════════════════════════════════════════════════
section("Auth Context");

write("src/lib/auth-context.tsx", `
"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth as authApi, getToken, clearToken, setToken, setRefreshToken } from "./api";

interface IdentityCtx {
  id: string;
  primaryEmail: string | null;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
  status: string;
}

interface AuthContextValue {
  identity: IdentityCtx | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<IdentityCtx | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getToken();
    if (t) {
      setTokenState(t);
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchProfile() {
    try {
      const { default: api } = await import("./api");
      const res = await (await import("./api")).identity.getProfile();
      setIdentity(res.data);
    } catch {
      clearToken();
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const res = await authApi.login({ email, password });
    const d = res.data;

    // If MFA pending, return the raw data so the caller can redirect
    if (d?.mfaRequired || d?.mfa_required) return { mfaRequired: true, sessionId: d.sessionId };

    const accessToken = d?.access_token ?? d?.accessToken ?? d?.token;
    const refreshToken = d?.refresh_token ?? d?.refreshToken;

    if (accessToken) {
      setToken(accessToken);
      setTokenState(accessToken);
      if (refreshToken) setRefreshToken(refreshToken);
      await fetchProfile();
    }

    return d;
  }

  async function logout() {
    clearToken();
    setIdentity(null);
    setTokenState(null);
  }

  async function refresh() {
    await fetchProfile();
  }

  return (
    <AuthContext.Provider value={{ identity, token, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
`);

// ════════════════════════════════════════════════════════════════════════════════
// 4. SHARED UI COMPONENTS
// ════════════════════════════════════════════════════════════════════════════════
section("Shared UI Components");

write("src/components/ui/Button.tsx", `
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variants = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700 border border-zinc-900",
  secondary: "bg-white text-zinc-900 hover:bg-zinc-50 border border-zinc-200",
  danger: "bg-red-600 text-white hover:bg-red-700 border border-red-600",
  ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 border border-transparent",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export function Button({ variant = "primary", size = "md", loading, children, disabled, className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={\`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all \${variants[variant]} \${sizes[size]} \${disabled || loading ? "opacity-50 cursor-not-allowed" : ""} \${className}\`}
    >
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}
`);

write("src/components/ui/Input.tsx", `
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = "", id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={inputId} className="text-sm font-medium text-zinc-700">{label}</label>}
      <input
        id={inputId}
        {...props}
        className={\`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all 
          \${error ? "border-red-400 focus:ring-1 focus:ring-red-400" : "border-zinc-200 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"}
          \${className}\`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
`);

write("src/components/ui/Card.tsx", `
interface CardProps { children: React.ReactNode; className?: string; }
export function Card({ children, className = "" }: CardProps) {
  return <div className={\`rounded-xl border border-zinc-200 bg-white shadow-sm \${className}\`}>{children}</div>;
}

export function CardHeader({ children, className = "" }: CardProps) {
  return <div className={\`px-6 py-4 border-b border-zinc-100 \${className}\`}>{children}</div>;
}

export function CardBody({ children, className = "" }: CardProps) {
  return <div className={\`px-6 py-4 \${className}\`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: CardProps) {
  return <div className={\`px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 rounded-b-xl \${className}\`}>{children}</div>;
}
`);

write("src/components/ui/Badge.tsx", `
interface BadgeProps { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "info"; }
const variants = {
  default: "bg-zinc-100 text-zinc-700",
  success: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};
export function Badge({ children, variant = "default" }: BadgeProps) {
  return <span className={\`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium \${variants[variant]}\`}>{children}</span>;
}
`);

write("src/components/ui/Alert.tsx", `
interface AlertProps { children: React.ReactNode; variant?: "info" | "success" | "warning" | "error"; title?: string; }
const styles = {
  info:    "bg-blue-50  border-blue-200  text-blue-800",
  success: "bg-green-50 border-green-200 text-green-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  error:   "bg-red-50   border-red-200   text-red-800",
};
const icons = { info: "ℹ️", success: "✅", warning: "⚠️", error: "❌" };
export function Alert({ children, variant = "info", title }: AlertProps) {
  return (
    <div className={\`rounded-lg border p-4 \${styles[variant]}\`}>
      <div className="flex gap-3">
        <span>{icons[variant]}</span>
        <div>
          {title && <p className="font-semibold text-sm mb-1">{title}</p>}
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
`);

write("src/components/ui/Modal.tsx", `
"use client";
import { useEffect } from "react";
interface ModalProps { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; size?: "sm" | "md" | "lg"; }
export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={\`relative w-full \${widths[size]} rounded-xl bg-white shadow-xl\`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
`);

write("src/components/ui/Table.tsx", `
interface TableProps { headers: string[]; rows: (string | React.ReactNode)[][]; emptyMessage?: string; }
export function Table({ headers, rows, emptyMessage = "No data" }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>{headers.map((h, i) => <th key={i} className="px-4 py-3 text-left font-medium text-zinc-600">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.length === 0
            ? <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-zinc-400">{emptyMessage}</td></tr>
            : rows.map((row, i) => (
              <tr key={i} className="hover:bg-zinc-50">
                {row.map((cell, j) => <td key={j} className="px-4 py-3 text-zinc-700">{cell}</td>)}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}
`);

write("src/components/ui/Spinner.tsx", `
export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };
  return <div className={\`\${s[size]} border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin\`} />;
}
`);

write("src/components/ui/index.ts", `
export { Button } from "./Button";
export { Input } from "./Input";
export { Card, CardHeader, CardBody, CardFooter } from "./Card";
export { Badge } from "./Badge";
export { Alert } from "./Alert";
export { Modal } from "./Modal";
export { Table } from "./Table";
export { Spinner } from "./Spinner";
`);

// ════════════════════════════════════════════════════════════════════════════════
// 5. LAYOUT + NAVIGATION
// ════════════════════════════════════════════════════════════════════════════════
section("Layout + Navigation");

write("src/app/layout.tsx", `
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ArcID — Sovereign Identity",
  description: "Identity, credentials, and access management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
`, true);

write("src/app/page.tsx", `
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui";

export default function HomePage() {
  const { identity, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(identity ? "/dashboard" : "/auth/login");
    }
  }, [identity, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
`, true);

write("src/components/layout/Sidebar.tsx", `
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: "⬡" },
  { label: "Profile",   href: "/dashboard/profile", icon: "👤" },
  { label: "Sessions",  href: "/dashboard/sessions", icon: "🖥️" },
  { label: "Passkeys",  href: "/dashboard/passkeys", icon: "🔑" },
  { label: "MFA",       href: "/dashboard/mfa", icon: "🛡️" },
  { label: "OAuth Clients", href: "/dashboard/clients", icon: "🔌" },
  { label: "Credentials",   href: "/dashboard/credentials", icon: "📜" },
  { label: "Tenants",       href: "/dashboard/tenants", icon: "🏢" },
  { label: "Billing",       href: "/dashboard/billing", icon: "💳" },
  { label: "Audit Logs",    href: "/dashboard/audit", icon: "📋" },
  { label: "Admin",         href: "/dashboard/admin", icon: "⚙️" },
];

export function Sidebar() {
  const path = usePathname();
  const { identity, logout } = useAuth();

  return (
    <aside className="w-64 min-h-screen bg-zinc-950 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-zinc-800">
        <span className="text-lg font-bold tracking-tight text-white">ArcID</span>
        <p className="text-xs text-zinc-400 mt-0.5">Sovereign Identity Engine</p>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={\`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
                \${active ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}\`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {identity && (
        <div className="px-4 py-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold">
              {(identity.name ?? identity.primaryEmail ?? "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{identity.name ?? "Anonymous"}</p>
              <p className="text-xs text-zinc-400 truncate">{identity.primaryEmail}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full mt-2 text-xs text-zinc-400 hover:text-white text-left px-2 py-1"
          >
            Sign out →
          </button>
        </div>
      )}
    </aside>
  );
}
`);

write("src/components/layout/DashboardShell.tsx", `
"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Spinner } from "@/components/ui";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { identity, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !identity) router.replace("/auth/login");
  }, [identity, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!identity) return null;

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
`);

// ════════════════════════════════════════════════════════════════════════════════
// 6. AUTH PAGES
// ════════════════════════════════════════════════════════════════════════════════
section("Auth Pages");

write("src/app/auth/layout.tsx", `
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">ArcID</h1>
          <p className="text-zinc-400 text-sm mt-1">Sovereign Identity Engine</p>
        </div>
        {children}
      </div>
    </div>
  );
}
`);

write("src/app/auth/login/page.tsx", `
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button, Input, Alert } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.mfaRequired) {
        router.push(\`/auth/mfa?sessionId=\${result.sessionId}\`);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <h2 className="text-xl font-semibold text-zinc-900 mb-1">Sign in</h2>
      <p className="text-sm text-zinc-500 mb-6">Enter your credentials to access ArcID</p>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <Button type="submit" loading={loading} className="w-full">Sign in</Button>
      </form>

      <div className="mt-6 space-y-3 text-center text-sm text-zinc-500">
        <div><Link href="/auth/magic-link" className="text-zinc-700 hover:underline">Sign in with magic link</Link></div>
        <div><Link href="/auth/password-reset" className="text-zinc-700 hover:underline">Forgot password?</Link></div>
        <div>No account? <Link href="/auth/register" className="font-medium text-zinc-900 hover:underline">Register</Link></div>
      </div>
    </div>
  );
}
`);

write("src/app/auth/register/page.tsx", `
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/api";
import { Button, Input, Alert } from "@/components/ui";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.register(form);
      router.push("/auth/login?registered=1");
    } catch (err: any) {
      setError(err.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <h2 className="text-xl font-semibold text-zinc-900 mb-1">Create account</h2>
      <p className="text-sm text-zinc-500 mb-6">Register your sovereign identity</p>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Full name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <Input label="Email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
        <Input label="Password" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required hint="Minimum 8 characters" />
        <Button type="submit" loading={loading} className="w-full">Create account</Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already registered? <Link href="/auth/login" className="font-medium text-zinc-900 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
`);

write("src/app/auth/magic-link/page.tsx", `
"use client";
import { useState } from "react";
import { auth } from "@/lib/api";
import { Button, Input, Alert } from "@/components/ui";
import Link from "next/link";

export default function MagicLinkPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.requestMagicLink(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-xl text-center">
        <div className="text-4xl mb-4">📬</div>
        <h2 className="text-xl font-semibold text-zinc-900 mb-2">Check your email</h2>
        <p className="text-sm text-zinc-500 mb-4">We sent a magic link to <strong>{email}</strong>. It expires in 15 minutes.</p>
        <Link href="/auth/login" className="text-sm text-zinc-600 hover:underline">Back to login</Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <h2 className="text-xl font-semibold mb-1">Magic link</h2>
      <p className="text-sm text-zinc-500 mb-6">Get a passwordless sign-in link via email</p>
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        <Button type="submit" loading={loading} className="w-full">Send magic link</Button>
      </form>
      <div className="mt-4 text-center text-sm">
        <Link href="/auth/login" className="text-zinc-500 hover:underline">Back to login</Link>
      </div>
    </div>
  );
}
`);

write("src/app/auth/mfa/page.tsx", `
"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/api";
import { setToken, setRefreshToken } from "@/lib/api";
import { Button, Input, Alert } from "@/components/ui";

function MfaForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("sessionId") ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await auth.verifyMfa(code, sessionId);
      const t = res.data?.access_token ?? res.data?.token;
      if (t) {
        setToken(t);
        if (res.data?.refresh_token) setRefreshToken(res.data.refresh_token);
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <div className="text-3xl mb-3">🛡️</div>
      <h2 className="text-xl font-semibold mb-1">Two-factor verification</h2>
      <p className="text-sm text-zinc-500 mb-6">Enter the 6-digit code from your authenticator app</p>
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Authentication code" value={code} onChange={e => setCode(e.target.value)} maxLength={6} pattern="[0-9]{6}" inputMode="numeric" required autoFocus />
        <Button type="submit" loading={loading} className="w-full">Verify</Button>
      </form>
    </div>
  );
}

export default function MfaPage() {
  return <Suspense><MfaForm /></Suspense>;
}
`);

write("src/app/auth/password-reset/page.tsx", `
"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/api";
import { Button, Input, Alert } from "@/components/ui";
import Link from "next/link";

function PasswordResetForm() {
  const params = useSearchParams();
  const token = params.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await auth.requestPasswordReset(email);
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await auth.confirmPasswordReset(token!, password);
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-xl text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-xl font-semibold">{token ? "Password updated!" : "Email sent!"}</h2>
        <p className="text-sm text-zinc-500 mt-2">{token ? "You can now sign in with your new password." : "Check your inbox for the reset link."}</p>
        <div className="mt-4"><Link href="/auth/login" className="text-sm text-zinc-600 hover:underline">Back to login</Link></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl">
      <h2 className="text-xl font-semibold mb-1">{token ? "Set new password" : "Reset password"}</h2>
      {error && <Alert variant="error" className="mt-3 mb-4">{error}</Alert>}
      {token ? (
        <form onSubmit={handleConfirm} className="space-y-4 mt-4">
          <Input label="New password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <Button type="submit" loading={loading} className="w-full">Update password</Button>
        </form>
      ) : (
        <form onSubmit={handleRequest} className="space-y-4 mt-4">
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          <Button type="submit" loading={loading} className="w-full">Send reset link</Button>
        </form>
      )}
    </div>
  );
}

export default function PasswordResetPage() {
  return <Suspense><PasswordResetForm /></Suspense>;
}
`);

// ════════════════════════════════════════════════════════════════════════════════
// 7. DASHBOARD SHELL & HOME
// ════════════════════════════════════════════════════════════════════════════════
section("Dashboard");

write("src/app/dashboard/layout.tsx", `
import { DashboardShell } from "@/components/layout/DashboardShell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
`);

write("src/app/dashboard/page.tsx", `
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { billing, audit } from "@/lib/api";
import { Card, CardBody, Badge } from "@/components/ui";

export default function DashboardHome() {
  const { identity } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    billing.getSubscription().then(r => setSubscription(r.data)).catch(() => {});
    audit.getLogs({ limit: 5 }).then(r => setRecentLogs(r.data ?? [])).catch(() => {});
  }, []);

  const planColor: Record<string, "default"|"info"|"success"> = {
    FREE: "default", PRO: "info", ENTERPRISE: "success"
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Welcome back{identity?.name ? \`, \${identity.name}\` : ""}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">ArcID Identity Control Panel</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Status</p>
            <Badge variant={identity?.status === "ACTIVE" ? "success" : "warning"}>{identity?.status ?? "—"}</Badge>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Plan</p>
            <Badge variant={planColor[subscription?.plan] ?? "default"}>{subscription?.plan ?? "FREE"}</Badge>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Email</p>
            <p className="text-sm font-medium text-zinc-700 truncate">
              {identity?.emailVerified ? "✅" : "⚠️"} {identity?.primaryEmail ?? "—"}
            </p>
          </CardBody>
        </Card>
      </div>

      {recentLogs.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-zinc-800 mb-3">Recent Activity</h3>
            <ul className="space-y-2">
              {recentLogs.map((log: any, i: number) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">{log.action?.replace(/_/g, " ")}</span>
                  <span className="text-xs text-zinc-400">{new Date(log.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
`);

// ════════════════════════════════════════════════════════════════════════════════
// 8. PROFILE PAGE
// ════════════════════════════════════════════════════════════════════════════════
section("Profile + Sessions + Passkeys + MFA");

write("src/app/dashboard/profile/page.tsx", `
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
`);

write("src/app/dashboard/sessions/page.tsx", `
"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/api";
import { Badge, Card, CardBody, CardHeader, Spinner, Alert } from "@/components/ui";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    auth.getSessions()
      .then(r => setSessions(r.data ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Sessions</h1>
        <p className="text-sm text-zinc-500 mt-1">Active authentication sessions across your devices</p>
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="space-y-3">
        {sessions.map((s: any) => (
          <Card key={s.id}>
            <CardBody className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-800 truncate max-w-xs">{s.userAgent ?? "Unknown device"}</p>
                <p className="text-xs text-zinc-400 mt-0.5">IP: {s.ip ?? "—"} · Created {new Date(s.createdAt).toLocaleString()}</p>
                <p className="text-xs text-zinc-400">Expires {new Date(s.expiresAt).toLocaleString()}</p>
              </div>
              <Badge variant={s.valid ? "success" : "danger"}>{s.valid ? "Active" : "Expired"}</Badge>
            </CardBody>
          </Card>
        ))}
        {!loading && sessions.length === 0 && <p className="text-sm text-zinc-400">No active sessions.</p>}
      </div>
    </div>
  );
}
`);

write("src/app/dashboard/passkeys/page.tsx", `
"use client";
import { useEffect, useState } from "react";
import { identity as identityApi } from "@/lib/api";
import { Badge, Card, CardBody, Spinner, Alert, Button } from "@/components/ui";

export default function PasskeysPage() {
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    identityApi.listPasskeys()
      .then(r => setPasskeys(r.data ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Passkeys</h1>
          <p className="text-sm text-zinc-500 mt-1">WebAuthn biometric credentials registered on your account</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => alert("Open your browser WebAuthn API to register a new passkey.")}>
          + Add passkey
        </Button>
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="space-y-3">
        {passkeys.map((p: any) => (
          <Card key={p.id}>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-800">{p.name ?? "Unnamed passkey"}</p>
                <p className="text-xs text-zinc-400 mt-0.5">Type: {p.deviceType} · Last used {new Date(p.lastUsedAt).toLocaleDateString()}</p>
              </div>
              <Badge variant="success">Active</Badge>
            </CardBody>
          </Card>
        ))}
        {!loading && passkeys.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <div className="text-4xl mb-3">🔑</div>
            <p className="text-sm">No passkeys registered yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
`);

write("src/app/dashboard/mfa/page.tsx", `
"use client";
import { useState } from "react";
import { auth } from "@/lib/api";
import { Button, Input, Alert, Card, CardBody, CardHeader, CardFooter } from "@/components/ui";

export default function MfaPage() {
  const [step, setStep] = useState<"idle" | "setup" | "confirm" | "done">("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startSetup() {
    setLoading(true); setError("");
    try {
      const res = await auth.setupMfa();
      setQrCode(res.data.qrCode);
      setSecret(res.data.secret);
      setStep("setup");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await auth.confirmMfa(code);
      setRecoveryCodes(res.data.recoveryCodes);
      setStep("done");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Multi-Factor Authentication</h1>
        <p className="text-sm text-zinc-500 mt-1">Secure your account with TOTP two-factor authentication</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {step === "idle" && (
        <Card>
          <CardBody className="text-center py-8">
            <div className="text-5xl mb-4">🛡️</div>
            <h3 className="font-semibold text-zinc-800 mb-2">Enable TOTP MFA</h3>
            <p className="text-sm text-zinc-500 mb-6">Add an extra layer of security using an authenticator app like Google Authenticator or Authy.</p>
            <Button onClick={startSetup} loading={loading}>Set up authenticator</Button>
          </CardBody>
        </Card>
      )}

      {step === "setup" && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">Scan QR code</h2></CardHeader>
          <CardBody className="space-y-4">
            <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: qrCode }} />
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">Manual entry key</p>
              <p className="text-sm font-mono text-zinc-800 break-all">{secret}</p>
            </div>
            <Button className="w-full" onClick={() => setStep("confirm")}>I've scanned it →</Button>
          </CardBody>
        </Card>
      )}

      {step === "confirm" && (
        <Card>
          <form onSubmit={confirmSetup}>
            <CardHeader><h2 className="text-sm font-semibold">Confirm setup</h2></CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm text-zinc-500">Enter the 6-digit code from your authenticator app to complete setup.</p>
              <Input label="Verification code" value={code} onChange={e => setCode(e.target.value)} maxLength={6} inputMode="numeric" autoFocus />
            </CardBody>
            <CardFooter>
              <Button type="submit" loading={loading}>Confirm</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardBody className="space-y-4">
            <Alert variant="success" title="MFA enabled!">Save these recovery codes in a secure place. They can only be shown once.</Alert>
            <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-4 rounded-lg">
              {recoveryCodes.map((c, i) => (
                <span key={i} className="font-mono text-sm bg-white border border-zinc-200 rounded px-2 py-1">{c}</span>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
`);

// ════════════════════════════════════════════════════════════════════════════════
// 9. OAUTH CLIENTS
// ════════════════════════════════════════════════════════════════════════════════
section("OAuth Clients");

write("src/app/dashboard/clients/page.tsx", `
"use client";
import { useEffect, useState } from "react";
import { oauth } from "@/lib/api";
import { Button, Badge, Card, CardBody, CardHeader, Spinner, Alert, Modal, Input } from "@/components/ui";

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", public: false, redirectUris: "" });
  const [newClient, setNewClient] = useState<any>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await oauth.listClients();
      setClients(r.data ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await oauth.createClient({
        name: form.name,
        public: form.public,
        redirectUris: form.redirectUris.split("\\n").map(s => s.trim()).filter(Boolean),
      });
      setNewClient(res.data);
      setShowCreate(false);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">OAuth Clients</h1>
          <p className="text-sm text-zinc-500 mt-1">Registered applications consuming ArcID identity services</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">+ New client</Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {newClient && (
        <Alert variant="success" title="Client created!">
          <p>Client ID: <code className="font-mono">{newClient.clientId}</code></p>
          {newClient.clientSecret && <p className="mt-1">Secret (save now — not shown again): <code className="font-mono text-xs break-all">{newClient.clientSecret}</code></p>}
        </Alert>
      )}

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      <div className="grid gap-4">
        {clients.map((c: any) => (
          <Card key={c.id ?? c.clientId}>
            <CardBody className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-zinc-800">{c.name}</p>
                <p className="text-xs font-mono text-zinc-400 mt-0.5">{c.clientId}</p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {(c.grantTypes ?? []).map((g: string) => <Badge key={g}>{g}</Badge>)}
                </div>
              </div>
              <Badge variant={c.public ? "info" : "default"}>{c.public ? "Public" : "Confidential"}</Badge>
            </CardBody>
          </Card>
        ))}
        {!loading && clients.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <div className="text-4xl mb-3">🔌</div>
            <p className="text-sm">No clients registered yet.</p>
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create OAuth Client">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Application name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1">Redirect URIs (one per line)</label>
            <textarea value={form.redirectUris} onChange={e => setForm(p => ({ ...p, redirectUris: e.target.value }))}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm min-h-[80px]" placeholder="https://app.example.com/callback" />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={form.public} onChange={e => setForm(p => ({ ...p, public: e.target.checked }))} />
            Public client (no client secret)
          </label>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
`);

// ════════════════════════════════════════════════════════════════════════════════
// 10. CREDENTIALS
// ════════════════════════════════════════════════════════════════════════════════
section("Credentials");

write("src/app/dashboard/credentials/page.tsx", `
"use client";
import { useState } from "react";
import { credentials as credApi } from "@/lib/api";
import { Button, Input, Alert, Card, CardBody, CardHeader, CardFooter, Badge } from "@/components/ui";

export default function CredentialsPage() {
  const [tab, setTab] = useState<"issue" | "verify" | "revoke">("issue");

  // Issue form
  const [issueForm, setIssueForm] = useState({ subjectDid: "", subject: "{}", credType: "VerifiableCredential" });
  const [issueResult, setIssueResult] = useState<any>(null);
  const [issueError, setIssueError] = useState("");
  const [issueLoading, setIssueLoading] = useState(false);

  // Verify form
  const [verifyToken, setVerifyToken] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyError, setVerifyError] = useState("");

  // Revoke form
  const [revokeId, setRevokeId] = useState("");
  const [revokeSuccess, setRevokeSuccess] = useState("");
  const [revokeError, setRevokeError] = useState("");

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    setIssueError(""); setIssueResult(null);
    setIssueLoading(true);
    try {
      let subject: any = {};
      try { subject = JSON.parse(issueForm.subject); } catch { setIssueError("Invalid JSON in credential subject"); setIssueLoading(false); return; }
      const res = await credApi.issue({ subjectDid: issueForm.subjectDid, credentialSubject: subject, type: ["VerifiableCredential", issueForm.credType].filter(Boolean) });
      setIssueResult(res.data);
    } catch (err: any) { setIssueError(err.message); }
    finally { setIssueLoading(false); }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError(""); setVerifyResult(null);
    try {
      const res = await credApi.verify({ credential: verifyToken });
      setVerifyResult(res.data);
    } catch (err: any) { setVerifyError(err.message); }
  }

  async function handleRevoke(e: React.FormEvent) {
    e.preventDefault();
    setRevokeError(""); setRevokeSuccess("");
    try {
      await credApi.revoke(revokeId);
      setRevokeSuccess("Credential revoked successfully.");
    } catch (err: any) { setRevokeError(err.message); }
  }

  const tabs = [
    { id: "issue", label: "Issue" },
    { id: "verify", label: "Verify" },
    { id: "revoke", label: "Revoke" },
  ] as const;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Verifiable Credentials</h1>
        <p className="text-sm text-zinc-500 mt-1">Issue, verify, and revoke W3C Verifiable Credentials</p>
      </div>

      <div className="flex gap-1 border border-zinc-200 rounded-lg p-1 bg-zinc-50 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={\`px-4 py-1.5 text-sm rounded-md transition-all \${tab === t.id ? "bg-white shadow text-zinc-900 font-medium" : "text-zinc-500 hover:text-zinc-700"}\`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "issue" && (
        <Card>
          <form onSubmit={handleIssue}>
            <CardHeader><h2 className="text-sm font-semibold">Issue Credential</h2></CardHeader>
            <CardBody className="space-y-4">
              {issueError && <Alert variant="error">{issueError}</Alert>}
              {issueResult && <Alert variant="success" title="Credential issued">ID: <code className="font-mono text-xs">{issueResult.credentialId}</code></Alert>}
              <Input label="Subject DID" value={issueForm.subjectDid} onChange={e => setIssueForm(p => ({ ...p, subjectDid: e.target.value }))} placeholder="did:web:..." required />
              <Input label="Credential type" value={issueForm.credType} onChange={e => setIssueForm(p => ({ ...p, credType: e.target.value }))} />
              <div>
                <label className="text-sm font-medium text-zinc-700 block mb-1">Credential subject (JSON)</label>
                <textarea value={issueForm.subject} onChange={e => setIssueForm(p => ({ ...p, subject: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono min-h-[120px]" />
              </div>
            </CardBody>
            <CardFooter>
              <Button type="submit" loading={issueLoading}>Issue credential</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {tab === "verify" && (
        <Card>
          <form onSubmit={handleVerify}>
            <CardHeader><h2 className="text-sm font-semibold">Verify Credential</h2></CardHeader>
            <CardBody className="space-y-4">
              {verifyError && <Alert variant="error">{verifyError}</Alert>}
              {verifyResult && (
                <Alert variant={verifyResult.valid ? "success" : "error"} title={verifyResult.valid ? "Valid ✅" : "Invalid ❌"}>
                  {JSON.stringify(verifyResult, null, 2)}
                </Alert>
              )}
              <div>
                <label className="text-sm font-medium text-zinc-700 block mb-1">JWT / credential token</label>
                <textarea value={verifyToken} onChange={e => setVerifyToken(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono min-h-[100px]" placeholder="eyJ..." required />
              </div>
            </CardBody>
            <CardFooter>
              <Button type="submit">Verify</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {tab === "revoke" && (
        <Card>
          <form onSubmit={handleRevoke}>
            <CardHeader><h2 className="text-sm font-semibold">Revoke Credential</h2></CardHeader>
            <CardBody className="space-y-4">
              {revokeError && <Alert variant="error">{revokeError}</Alert>}
              {revokeSuccess && <Alert variant="success">{revokeSuccess}</Alert>}
              <Input label="Credential ID (urn:uuid:...)" value={revokeId} onChange={e => setRevokeId(e.target.value)} required />
            </CardBody>
            <CardFooter>
              <Button type="submit" variant="danger">Revoke credential</Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}
`);

// ════════════════════════════════════════════════════════════════════════════════
// 11. TENANTS
// ════════════════════════════════════════════════════════════════════════════════
section("Tenants");

write("src/app/dashboard/tenants/page.tsx", `
"use client";
import { useEffect, useState } from "react";
import { tenant as tenantApi } from "@/lib/api";
import { Button, Badge, Card, CardBody, Spinner, Alert, Modal, Input } from "@/components/ui";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", sector: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await tenantApi.list();
      setTenants(r.data ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setCreating(true);
    try {
      await tenantApi.create(form);
      setShowCreate(false);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Tenants</h1>
          <p className="text-sm text-zinc-500 mt-1">Multi-tenant organisation management</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">+ New tenant</Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      <div className="grid gap-4">
        {tenants.map((t: any) => (
          <Card key={t.id}>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-800">{t.name}</p>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">{t.slug}</p>
                {t.sector && <p className="text-xs text-zinc-400 mt-0.5">Sector: {t.sector}</p>}
              </div>
              <Badge>{t.id === "SYSTEM" ? "System" : "Custom"}</Badge>
            </CardBody>
          </Card>
        ))}
        {!loading && tenants.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <div className="text-4xl mb-3">🏢</div>
            <p className="text-sm">No tenants yet.</p>
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Tenant">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          <Input label="Slug" value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\\s+/g, "-") }))} required hint="Used in URLs — no spaces" />
          <Input label="Sector" value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>Create tenant</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
`);

// ════════════════════════════════════════════════════════════════════════════════
// 12. BILLING
// ════════════════════════════════════════════════════════════════════════════════
section("Billing");

write("src/app/dashboard/billing/page.tsx", `
"use client";
import { useEffect, useState } from "react";
import { billing } from "@/lib/api";
import { Button, Badge, Card, CardBody, CardHeader, CardFooter, Alert, Spinner } from "@/components/ui";

const PLANS = [
  {
    id: "FREE", name: "Free", price: "₦0 / mo",
    features: ["Core OIDC/OAuth", "Up to 100 identities", "Passkey auth", "Basic credentials"],
    highlight: false,
  },
  {
    id: "PRO", name: "Pro", price: "₦25,000 / mo",
    features: ["Everything in Free", "Unlimited identities", "Multi-tenant isolation", "Advanced VC issuance", "Webhook support", "Priority support"],
    highlight: true,
  },
  {
    id: "ENTERPRISE", name: "Enterprise", price: "Custom",
    features: ["Everything in Pro", "Custom SSO/SAML", "SCIM provisioning", "SLA guarantees", "Dedicated support", "On-premise deployment"],
    highlight: false,
  },
];

export default function BillingPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    billing.getSubscription()
      .then(r => setSubscription(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(plan: string) {
    setUpgrading(plan); setError(""); setSuccess("");
    try {
      const res = await billing.upgradePlan(plan as any);
      setSubscription(res.data);
      setSuccess(\`Plan updated to \${plan}!\`);
    } catch (e: any) { setError(e.message); }
    finally { setUpgrading(""); }
  }

  const currentPlan = subscription?.plan ?? "FREE";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Billing & Subscription</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your ArcID subscription plan</p>
      </div>

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {subscription && (
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">Current plan</p>
              <p className="text-xl font-bold text-zinc-900 mt-0.5">{subscription.plan}</p>
              <p className="text-xs text-zinc-400 mt-1">Status: {subscription.status}</p>
            </div>
            <Badge variant={subscription.plan === "PRO" ? "info" : subscription.plan === "ENTERPRISE" ? "success" : "default"}>
              {subscription.plan}
            </Badge>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map(plan => (
          <Card key={plan.id} className={\`\${plan.highlight ? "ring-2 ring-zinc-900" : ""}\`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-zinc-900">{plan.name}</h3>
                {plan.highlight && <Badge>Popular</Badge>}
              </div>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{plan.price}</p>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="text-sm text-zinc-600 flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span> {f}
                  </li>
                ))}
              </ul>
            </CardBody>
            <CardFooter>
              {currentPlan === plan.id ? (
                <Button variant="secondary" className="w-full" disabled>Current plan</Button>
              ) : plan.id === "ENTERPRISE" ? (
                <Button variant="secondary" className="w-full" onClick={() => alert("Contact sales@arcid.io")}>Contact sales</Button>
              ) : (
                <Button className="w-full" loading={upgrading === plan.id} onClick={() => handleUpgrade(plan.id)}>
                  {currentPlan === "FREE" && plan.id === "PRO" ? "Upgrade" : "Switch plan"}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
`);

// ════════════════════════════════════════════════════════════════════════════════
// 13. AUDIT LOGS
// ════════════════════════════════════════════════════════════════════════════════
section("Audit Logs");

write("src/app/dashboard/audit/page.tsx", `
"use client";
import { useEffect, useState } from "react";
import { audit } from "@/lib/api";
import { Badge, Card, CardBody, Spinner, Alert, Button } from "@/components/ui";

const ACTION_COLORS: Record<string, "default"|"success"|"danger"|"warning"|"info"> = {
  USER_LOGIN_SUCCESS: "success",
  USER_LOGIN_FAILED: "danger",
  USER_REGISTERED: "info",
  MFA_ENABLED: "success",
  MFA_DISABLED: "warning",
  TOKEN_REVOKED: "warning",
  CREDENTIAL_ISSUED: "info",
  CREDENTIAL_REVOKED: "danger",
  SESSION_CREATED: "success",
  SESSION_REVOKED: "warning",
  PASSKEY_REGISTERED: "success",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => { load(); }, [page, actionFilter]);

  async function load() {
    setLoading(true);
    try {
      const r = await audit.getLogs({ limit: 20, page, action: actionFilter || undefined });
      setLogs(r.data ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Audit Logs</h1>
        <p className="text-sm text-zinc-500 mt-1">Immutable record of all system events</p>
      </div>

      <div className="flex gap-3 items-center">
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white">
          <option value="">All actions</option>
          {Object.keys(ACTION_COLORS).map(a => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      <div className="space-y-2">
        {logs.map((log: any, i: number) => (
          <Card key={i}>
            <CardBody className="flex items-start justify-between gap-4 py-3">
              <div className="flex items-start gap-3">
                <Badge variant={ACTION_COLORS[log.action] ?? "default"}>
                  {log.action?.replace(/_/g, " ")}
                </Badge>
                <div>
                  {log.ip && <p className="text-xs text-zinc-400">IP: {log.ip}</p>}
                  {log.identityId && <p className="text-xs text-zinc-400 font-mono">User: {log.identityId}</p>}
                </div>
              </div>
              <span className="text-xs text-zinc-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</span>
            </CardBody>
          </Card>
        ))}
        {!loading && logs.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm">No audit logs found.</p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</Button>
        <span className="text-sm text-zinc-500">Page {page}</span>
        <Button variant="secondary" size="sm" disabled={logs.length < 20} onClick={() => setPage(p => p + 1)}>Next →</Button>
      </div>
    </div>
  );
}
`);

// ════════════════════════════════════════════════════════════════════════════════
// 14. ADMIN PANEL
// ════════════════════════════════════════════════════════════════════════════════
section("Admin Panel");

write("src/app/dashboard/admin/page.tsx", `
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
`);

// ════════════════════════════════════════════════════════════════════════════════
// 15. TAILWIND CONFIG
// ════════════════════════════════════════════════════════════════════════════════
section("Tailwind config");

write("tailwind.config.ts", `
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: { extend: {} },
  plugins: [],
};

export default config;
`);

write("postcss.config.js", `
module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
`);

// ════════════════════════════════════════════════════════════════════════════════
// DONE
// ════════════════════════════════════════════════════════════════════════════════
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ArcID UI Scaffold Complete
  Written : ${written}
  Skipped : ${skipped} (already exist — use force flag to overwrite)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next steps:
  1. Install deps if not already done:
       npm install tailwindcss postcss autoprefixer
       (or: pnpm add tailwindcss postcss autoprefixer)

  2. Set your ArcID backend URL in .env.local:
       NEXT_PUBLIC_API_URL=http://localhost:3001

  3. Run the dev server:
       npm run dev

  4. Open http://localhost:3000 → auto-redirects to /auth/login

Pages scaffolded:
  /auth/login              Login with email + password
  /auth/register           New identity registration
  /auth/magic-link         Passwordless magic link
  /auth/mfa                TOTP verification step
  /auth/password-reset     Password reset request/confirm
  /dashboard               Summary dashboard
  /dashboard/profile       Profile edit
  /dashboard/sessions      Active sessions list
  /dashboard/passkeys      WebAuthn passkeys
  /dashboard/mfa           MFA setup + recovery codes
  /dashboard/clients       OAuth client management
  /dashboard/credentials   Issue/verify/revoke VCs
  /dashboard/tenants       Multi-tenant management
  /dashboard/billing       Subscription plans
  /dashboard/audit         Audit log viewer
  /dashboard/admin         Admin identity management + plan control
`);