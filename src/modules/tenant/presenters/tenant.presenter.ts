import type { Tenant } from "@prisma-client";

export function presentTenant(tenant: Tenant) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    sector: tenant.sector,
    createdAt: tenant.createdAt,
  };
}
