"use client";

import { useTenant } from "@/hooks/use-tenant";
import { useAuth } from "@/hooks/use-auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@arcevo/facet-components";

export function TenantSwitcher() {
  const { activeTenant, tenants: tenantList, isLoading, switchTenant } = useTenant();
  const { isAuthenticated } = useAuth();

  // Don't render the switcher if not authenticated, still loading,
  // or the user only has one tenant.
  if (!isAuthenticated || isLoading || tenantList.length <= 1) return null;

  return (
    <Select
      value={activeTenant?.id ?? tenantList[0]?.id}
      onValueChange={(tenantId) => switchTenant(tenantId)}
    >
      <SelectTrigger className="w-[200px] h-8">
        <SelectValue placeholder="Select organisation" />
      </SelectTrigger>
      <SelectContent>
        {tenantList.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {t.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
