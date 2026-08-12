"use client";

import { useCallback } from "react";
import { useTenantStore } from "@/store/tenant.store";
import { useAuthStore } from "@/store/auth.store";
import { tenants, arcIdClient, persistSession } from "@/sdk";

export function useTenant() {
  const { activeTenant, tenants: tenantList, isLoading, setActiveTenant, setTenants, setLoading } =
    useTenantStore();

  const hydrateTenants = useCallback(async () => {
    setLoading(true);
    const result = await tenants.list();
    if (result.data && result.data.length > 0) {
      setTenants(result.data);
      const stored = localStorage.getItem("arcid-active-tenant");
      const saved = stored ? JSON.parse(stored) : null;
      const target = saved ? result.data.find((t: any) => t.id === saved.id) : result.data[0];
      if (target) setActiveTenant(target);
    } else {
      setTenants([]);
      setActiveTenant(null);
    }
    setLoading(false);
  }, [setActiveTenant, setTenants, setLoading]);

  const switchTenant = useCallback(
    async (tenantId: string) => {
      const result = await tenants.switchTenant(tenantId);
      if (result.data) {
        const target = tenantList.find((t) => t.id === tenantId) ?? null;
        setActiveTenant(target);
        if (target) localStorage.setItem("arcid-active-tenant", JSON.stringify(target));

        // switch-context returns a fresh token bundle scoped to the new
        // tenant — push it into the auth store + client or every subsequent
        // call keeps using the old tenant's token.
        const { accessToken, refreshToken } = result.data;
        const { user } = useAuthStore.getState();
        if (user) {
          useAuthStore.getState().setAuth(user, accessToken, refreshToken);
        } else {
          useAuthStore.getState().setTokens(accessToken, refreshToken);
        }
        arcIdClient.setAccessToken(accessToken);
        if (user) persistSession(user, accessToken, refreshToken);
      }
      return result;
    },
    [tenantList, setActiveTenant],
  );

  return {
    activeTenant,
    tenants: tenantList,
    isLoading,
    setActiveTenant,
    setTenants,
    hydrateTenants,
    switchTenant,
  };
}
