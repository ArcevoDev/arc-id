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
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
                ${active ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"}`}
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
