import { create } from "zustand";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  sector?: string | null;
  role?: string;
}

export interface TenantState {
  activeTenant: Tenant | null;
  tenants: Tenant[];
  isLoading: boolean;
  setActiveTenant: (tenant: Tenant | null) => void;
  setTenants: (tenants: Tenant[]) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  activeTenant: null,
  tenants: [],
  isLoading: false,
  setActiveTenant: (activeTenant) => set({ activeTenant }),
  setTenants: (tenants) => set({ tenants }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ activeTenant: null, tenants: [], isLoading: false }),
}));
