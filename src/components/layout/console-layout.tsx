// src/components/layout/console-layout.tsx
// App shell — wraps all dashboard pages. Sidebar/Topbar come from
// lib/ui/navigation.ts (nav config) via the Sidebar component.
"use client";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { AppLayout } from "./app-layout";
import { useUiStore } from "@/store/ui.store";

export function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  return (
    <AppLayout
      variant="console"
      sidebar={<Sidebar />}
      topbar={<Topbar />}
      collapsed={collapsed}
    >
      {children}
    </AppLayout>
  );
}
