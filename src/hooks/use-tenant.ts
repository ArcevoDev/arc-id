"use client";

import { useCallback } from "react";
import { useTenantStore } from "@/store/tenant.store";
import { tenants } from "@/sdk";

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
