"use client";

import { useAuth } from "@/hooks/use-auth";
import { useUI } from "@/hooks/use-ui";
import { useMobile } from "@/hooks/use-mobile";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Sheet, SheetContent } from "@arcevo/facet-components";

/**
 * Dashboard shell — sidebar + topbar + centered content area.
 * On mobile the sidebar collapses into a sheet overlay.
 */
export function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { sidebarOpen, setSidebarOpen } = useUI();
  const isMobile = useMobile();

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not authenticated — render children directly (auth pages)
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar (sheet) */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[260px] p-0">
            <Sidebar />
          </SheetContent>
        </Sheet>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col lg:pl-[260px]">
        <Topbar />
        <main className="flex-1 p-6">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
