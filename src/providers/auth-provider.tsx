"use client";

import { useEffect, useRef } from "react";
import { useAuthStore, useTenantStore } from "@arcevo/facet-store";
import { tenants, arcIdClient } from "@/sdk";

/**
 * AuthProvider - reads stored tokens on mount and restores session.
 * After session restoration, hydrates the tenant store with the user's
 * organisations.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setLoading } = useAuthStore();
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
           // Attempt to restore user identity from storage.
      // Tokens are NO LONGER persisted to localStorage — the refresh token
      // lives in an httpOnly cookie. We set isAuthenticated=true with empty
      // tokens; the SDK's onTokenRefresh will fire on the first 401 and
      // use the cookie to obtain a fresh access token.
      try {
        const stored = localStorage.getItem("arcid-session");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.user) {
            useAuthStore.getState().setAuth(parsed.user, "", "");
          }
        }
      } catch {
        // No stored session - user is unauthenticated
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Hydrate tenant store with user's organisations. hydrated.current is
      // only set after a successful list - a transient network failure must
      // not permanently disable tenant hydration for the whole session.
      if (!cancelled && useAuthStore.getState().isAuthenticated && !hydrated.current) {
        const result = await tenants.list();
        if (!cancelled) {
          if (result.data && result.data.length > 0) {
            useTenantStore.getState().setTenants(result.data);
            const stored = localStorage.getItem("arcid-active-tenant");
            const saved = stored ? JSON.parse(stored) : null;
            const target = saved
              ? result.data.find((t: any) => t.id === saved.id)
              : result.data[0];
            if (target) useTenantStore.getState().setActiveTenant(target);
          }
          hydrated.current = true;
        }
      }
    }

    init();

    return () => { cancelled = true; };
  }, [setLoading]);

  return <>{children}</>;
}
