"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConsoleLayout } from "@arcevo/facet-layout";
import { buildLayoutConfig } from "@/config/layout";
import { useTenant } from "@/hooks/use-tenant";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { activeTenant, tenants, switchTenant } = useTenant();
  const pathname = usePathname();
  const config = buildLayoutConfig();

  const router = {
    Link: (props: React.ComponentProps<typeof Link>) => <Link {...props} />,
    isActive: (href: string) => pathname === href || pathname.startsWith(href + "/"),
  };

  return (
    <ConsoleLayout
      config={config}
      tenants={tenants}
      activeTenant={activeTenant}
      onTenantSwitch={(id) => switchTenant(id)}
      router={router}
    >
      {children}
    </ConsoleLayout>
  );
}
