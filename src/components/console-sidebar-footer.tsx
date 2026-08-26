"use client";

import { useRouter } from "next/navigation";
import { Popover, PopoverTrigger, PopoverContent, Button, Icon } from "@arcevo/facet-components";
import { useLayout } from "@arcevo/facet-layout";
import { useAuthStore } from "@arcevo/facet-store";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/providers/theme-provider";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ConsoleSidebarFooter() {
  const { sidebarWidth, sidebarCollapsed } = useLayout();
  const { user } = useAuthStore();
  const { clearSession } = useAuth();
  const router = useRouter();
  const { toggleTheme } = useTheme();

  const width = sidebarCollapsed ? 68 : sidebarWidth;

  if (sidebarCollapsed || !user) return null;

  return (
    <div
      className="fixed bottom-0 left-0 z-50 hidden border-t border-sidebar-border bg-sidebar lg:block"
      style={{ width: `${width}px` }}
    >
      <div className="flex items-center justify-between p-3">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-3 rounded-md p-1 text-left hover:bg-sidebar-accent">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name ?? "User"}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  {getInitials(user.name ?? "User")}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user.name ?? "User"}</span>
                <span className="text-xs text-sidebar-foreground/60 truncate max-w-[120px]">
                  {user.email ?? ""}
                </span>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-56 p-2">
            <div className="flex flex-col gap-1 text-sm">
              <button
                className="flex items-center gap-2 rounded-md p-2 text-left hover:bg-accent"
                onClick={() => router.push("/console/user")}
              >
                <Icon name="user" className="h-4 w-4" />
                Profile
              </button>
              <button
                className="flex items-center gap-2 rounded-md p-2 text-left hover:bg-accent"
                onClick={() => router.push("/console")}
              >
                <Icon name="layout-dashboard" className="h-4 w-4" />
                Console
              </button>
              <button
                className="flex items-center gap-2 rounded-md p-2 text-left hover:bg-accent"
                onClick={toggleTheme}
              >
                <Icon name="palette" className="h-4 w-4" />
                Appearance
              </button>
              <div className="border-t my-1" />
              <button
                className="flex items-center gap-2 rounded-md p-2 text-left hover:bg-accent"
                onClick={() => router.push("/home")}
              >
                <Icon name="home" className="h-4 w-4" />
                Back to home
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearSession();
            router.push("/login");
          }}
        >
          <Icon name="log-out" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
