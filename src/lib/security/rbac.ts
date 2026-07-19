// src/lib/security/rbac.ts
//
// Permission-check utilities for the dynamic RBAC system.
//
// Permissions are stored in the Permission table (action strings like
// "client:create") and assigned to Roles via the RolePermission join table.
// A user has a permission for a tenant if their active TenantMembership's
// Role is linked to a RolePermission whose Permission.action matches.

import type { DbClient } from "@/lib/db-client";

/**
 * Check whether an identity has a specific permission within a tenant.
 *
 * @returns true if the identity has an active membership with a role that
 *   includes the given permission action string.
 */
export async function hasPermission(
  db: DbClient,
  identityId: string,
  tenantId: string,
  action: string,
): Promise<boolean> {
  const membership = await db.tenantMembership.findFirst({
    where: { identityId, tenantId, status: "ACTIVE" },
    select: {
      role: {
        select: {
          permissions: {
            where: { permission: { action } },
            select: { permissionId: true },
            take: 1,
          },
        },
      },
    },
  });

  return membership !== null && membership.role.permissions.length > 0;
}
