"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConsoleLayout } from "@arcevo/facet-layout";
import type { RouterAdapter, RouterLinkProps } from "@arcevo/facet-layout";
import { buildLayoutConfig } from "@/config/layout";
import { useAuthStore, useTenantStore } from "@arcevo/facet-store";
import { ConsoleSidebarFooter } from "@/components/console-sidebar-footer";

export default function ConsoleRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { accessToken, isLoading, user } = useAuthStore();
  const { activeTenant, setActiveTenant } = useTenantStore();

  if (isLoading || !accessToken) {
    return null;
  }

  const nextRouterAdapter: RouterAdapter = {
    Link: ({ href, children: linkChildren, className }: RouterLinkProps) => (
      <Link href={href} className={className}>
        {linkChildren}
      </Link>
    ),
    isActive: (href: string) => {
      if (href === "/") return pathname === "/";
      return (
        pathname === href ||
        pathname.startsWith(href.endsWith("/") ? href : href + "/")
      );
    },
  };

  const tenants = (user?.memberships ?? []).map((m) => ({
    id: m.tenantId,
    name: m.name ?? m.tenantId,
  }));

  const handleTenantSwitch = (id: string) => {
    const tenant = tenants.find((t) => t.id === id);
    setActiveTenant(
      tenant
        ? {
            ...tenant,
            slug: tenant.id,
            createdAt: "",
          }
        : null,
    );
  };

  return (
    <ConsoleLayout
      config={buildLayoutConfig()}
      router={nextRouterAdapter}
      tenants={tenants}
      activeTenant={activeTenant ?? null}
      onTenantSwitch={handleTenantSwitch}
      themeToggle
    >
      {children}
      <ConsoleSidebarFooter />
    </ConsoleLayout>
  );
}
