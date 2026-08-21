"use client";

import { useCallback } from "react";
import { useAuthStore, useTenantStore } from "@arcevo/facet-store";
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
      const target = saved ? result.data.find((t) => t.id === saved.id) : result.data[0];
      if (target) setActiveTenant(target);
    } else {
      setTenants([]);
      setActiveTenant(null);
    }
    setLoading(false);
  }, [setActiveTenant, setTenants, setLoading]);

  const listMembers = useCallback(
    async (tenantId: string) => {
      if (!useAuthStore.getState().accessToken) {
        return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
      }
      return tenants.listMembers(tenantId);
    },
    [],
  );

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

  const createTenant = useCallback(
    async (name: string, slug: string) => {
      if (!useAuthStore.getState().accessToken) {
        return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
      }
      const result = await tenants.create({ name, slug });
      if (result.data) {
        setTenants([result.data, ...tenantList]);
        setActiveTenant(result.data);
        localStorage.setItem("arcid-active-tenant", JSON.stringify(result.data));
      }
      return result;
    },
    [tenantList, setActiveTenant, setTenants],
  );

  const acceptInvite = useCallback(async (token: string) => {
    return tenants.acceptInvite({ token });
  }, []);

  return {
    activeTenant,
    tenants: tenantList,
    isLoading,
    setActiveTenant,
    setTenants,
    hydrateTenants,
    listMembers,
    switchTenant,
    createTenant,
    acceptInvite,
  };
}
