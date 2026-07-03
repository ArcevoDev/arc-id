// src/providers/auth-provider.tsx
// Hydrates auth store on mount and handles route protection.
// Components read from useAuthStore — never from this provider directly.
"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useTenantStore } from "@/store/tenant.store";

const PUBLIC = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/mfa",
];
const isPublic = (p: string) => PUBLIC.some((pub) => p.startsWith(pub));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { hydrate, isAuthenticated, isLoading } = useAuthStore();
  const { fetchTenants } = useTenantStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !isPublic(pathname)) {
      router.replace("/login");
    }
    if (isAuthenticated) {
      fetchTenants().catch(() => {});
    }
  }, [isAuthenticated, isLoading, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
