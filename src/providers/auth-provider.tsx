"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useTenantStore } from "@/store/tenant.store";
import { tenants } from "@/sdk";

/**
 * AuthProvider — reads stored tokens on mount and restores session.
 * After session restoration, hydrates the tenant store with the user's
 * organisations.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setLoading } = useAuthStore();
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Attempt to restore session from storage
      try {
        const stored = localStorage.getItem("arcid-auth");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.accessToken && parsed.user) {
            useAuthStore.getState().setAuth(
              parsed.user,
              parsed.accessToken,
              parsed.refreshToken ?? "",
            );
          }
        }
      } catch {
        // No stored session — user is unauthenticated
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Hydrate tenant store with user's organisations
      if (!cancelled && useAuthStore.getState().isAuthenticated && !hydrated.current) {
        hydrated.current = true;
        const result = await tenants.list();
        if (!cancelled && result.data && result.data.length > 0) {
          useTenantStore.getState().setTenants(result.data);
          const stored = localStorage.getItem("arcid-active-tenant");
          const saved = stored ? JSON.parse(stored) : null;
          const target = saved
            ? result.data.find((t: any) => t.id === saved.id)
            : result.data[0];
          if (target) useTenantStore.getState().setActiveTenant(target);
        }
      }
    }

    init();

    return () => { cancelled = true; };
  }, [setLoading]);

  return <>{children}</>;
}
