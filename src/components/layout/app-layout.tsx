// src/components/layout/app-layout.tsx
//
// Shared shell. Other layouts (ConsoleLayout, AuthLayout, and any future
// "EmbedLayout" for the package-extraction path) call this with their own
// sidebar/topbar — sourced from `lib/ui/navigation.ts` — rather than each
// hand-rolling the outer <div> structure.
//
//   variant="console"  — sidebar + topbar + scrollable max-w-7xl content.
//                         Sidebar width is read from `sidebar`'s collapsed
//                         state via the `collapsed` prop (caller owns the
//                         store subscription, AppLayout just applies the margin).
//
//   variant="centered" — single centered column, no chrome. Used by
//                         (auth)/* pages and anywhere a focused, single-task
//                         layout is wanted (onboarding steps, consent screens).

import { cn } from "@/lib/utils";

interface AppLayoutProps {
  variant?: "console" | "centered";
  sidebar?: React.ReactNode;
  topbar?: React.ReactNode;
  collapsed?: boolean;
  /** Tailwind max-width class for the centered variant. Default: max-w-md */
  maxWidth?: string;
  children: React.ReactNode;
}

export function AppLayout({
  variant = "console",
  sidebar,
  topbar,
  collapsed = false,
  maxWidth = "max-w-md",
  children,
}: AppLayoutProps) {
  if (variant === "centered") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className={cn("w-full", maxWidth)}>{children}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {sidebar}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-200",
          sidebar && (collapsed ? "ml-16" : "ml-64"),
        )}
      >
        {topbar}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
