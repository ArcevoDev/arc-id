"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@arcevo/facet-components";

/**
 * Account portal shell - Clerk-style /user pages with a left nav of
 * sections (Profile, Security, Sessions). Each section is a real route
 * under /user so links stay shareable.
 */
const SECTIONS = [
  { href: "/user", label: "Profile", icon: "user" as const, exact: true },
  { href: "/user/security", label: "Security", icon: "shield" as const, exact: false },
];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and security settings</p>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <nav className="md:w-48 shrink-0 flex md:flex-col gap-1">
          {SECTIONS.map((s) => {
            const active = s.exact ? pathname === s.href : pathname.startsWith(s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
