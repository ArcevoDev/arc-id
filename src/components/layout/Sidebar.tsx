// src/components/layout/sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUiStore } from "@/store/ui.store";
import { useTenant } from "@/hooks/use-tenant";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/ui/icon-registry";
import { navigationGroups } from "@/lib/ui/navigation";
import { ArcMetadata } from "@/lib/ui/metadata";

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const { activeTenant } = useTenant();

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 h-full z-40 flex flex-col border-r border-border bg-sidebar transition-all duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <Icons.lock className="w-4 h-4 text-primary" />
          </div>
          {!collapsed && (
            <span className="font-bold text-sm text-foreground tracking-wide truncate">
              {ArcMetadata.shortName}
            </span>
          )}
        </div>
      </div>

      {/* Active tenant */}
      {!collapsed && activeTenant && (
        <div className="px-3 py-2 border-b border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1">
            Workspace
          </p>
          <p className="text-xs text-foreground font-medium truncate">
            {activeTenant.name}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {activeTenant.plan}
          </span>
        </div>
      )}

      {/* Nav — driven by navigation.ts */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navigationGroups.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {!collapsed && group.title && (
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group.title}
              </p>
            )}
            {group.items.map(({ label, href, icon, badge }) => {
              const Icon = Icons[icon];
              const active =
                pathname === href ||
                (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium border border-primary/20"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    collapsed && "justify-center px-2",
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1">{label}</span>
                      {badge && (
                        <span className="ml-auto text-[10px] font-medium bg-primary/20 text-primary rounded px-1.5 py-0.5">
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-border">
        <button
          onClick={toggle}
          className={cn(
            "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
            collapsed && "justify-center px-2",
          )}
        >
          <Icons.chevronLeft
            className={cn(
              "w-4 h-4 transition-transform",
              collapsed && "rotate-180",
            )}
          />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
