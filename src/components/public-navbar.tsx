"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Navbar, Button, UserAvatar } from "@arcevo/facet-components";
import { useAuthStore } from "@arcevo/facet-store";
import type { RouterAdapter, RouterLinkProps } from "@arcevo/facet-layout";
import { useAuth } from "@/hooks/use-auth";

export const navLinks = [
  { label: "Features", href: "/home" },
  { label: "Console", href: "/console" },
  { label: "Pricing", href: "/pricing" },
];

export function PublicNavbar() {
  const { user } = useAuthStore();
  const { clearSession } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const navUser = user
    ? {
        name: user.name ?? null,
        email: user.email ?? null,
        picture: user.picture ?? null,
        memberships:
          user.memberships?.map((m) => ({
            tenantId: m.tenantId,
            name: m.name ?? null,
            role: m.role,
          })) ?? [],
      }
    : undefined;

  const nextRouterAdapter: RouterAdapter = {
    Link: ({ href, children, ...props }: RouterLinkProps) => (
      <Link href={href} {...props}>
        {children}
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

  return (
    <Navbar
      variant="pill"
      brand={
        <Link href="/" className="font-display text-xl font-semibold">
          ArcID
        </Link>
      }
      showThemeToggle
      links={navLinks}
      router={nextRouterAdapter}
      actions={
        navUser ? (
          <UserAvatar
            user={navUser}
            className="hidden md:block"
            items={[
              {
                label: "Console",
                icon: "layout-dashboard",
                onSelect: () => router.push("/console"),
              },
            ]}
            settingsHref="/console/user"
            onSignOut={() => {
              clearSession();
              router.push("/login");
            }}
          />
        ) : (
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Login
            </Button>
          </Link>
        )
      }
    />
  );
}
