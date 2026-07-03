// src/store/tenant.store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { tenantSdk } from "@/sdk/tenant.sdk";
import { TOKEN_KEYS } from "@/sdk/client";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

interface TenantState {
  activeTenant: Tenant | null;
  tenants: Tenant[];
  isLoading: boolean;
  fetchTenants: () => Promise<void>;
  switchTenant: (tenant: Tenant) => Promise<void>;
  clearTenants: () => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      activeTenant: null,
      tenants: [],
      isLoading: false,

      fetchTenants: async () => {
        set({ isLoading: true });
        try {
          const tenants = await tenantSdk.list();
          set({ tenants, isLoading: false });
          if (!get().activeTenant && tenants.length > 0) {
            set({ activeTenant: tenants[0] });
            localStorage.setItem(TOKEN_KEYS.tenant, tenants[0].id);
          }
        } catch {
          set({ isLoading: false });
        }
      },

      switchTenant: async (tenant) => {
        try {
          await tenantSdk.switchContext(tenant.id);
          localStorage.setItem(TOKEN_KEYS.tenant, tenant.id);
          set({ activeTenant: tenant });
        } catch (err: any) {
          throw err;
        }
      },

      clearTenants: () => {
        set({ activeTenant: null, tenants: [] });
        localStorage.removeItem(TOKEN_KEYS.tenant);
      },
    }),
    {
      name: "arcid-tenant",
      partialize: (s) => ({ activeTenant: s.activeTenant }),
    },
  ),
);
