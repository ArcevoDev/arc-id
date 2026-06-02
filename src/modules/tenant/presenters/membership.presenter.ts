import type { TenantMembership, Role } from "@/prisma-client";

type MembershipWithRole = TenantMembership & { role: Role };

export function presentMembership(membership: MembershipWithRole) {
  return {
    id: membership.id,
    identityId: membership.identityId,
    tenantId: membership.tenantId,
    role: membership.role.name,
    status: membership.status,
    createdAt: membership.createdAt,
  };
}

// Overload for cases where role isn't eagerly loaded
export function presentMembershipBasic(
  membership: TenantMembership & { role?: Role },
) {
  return {
    id: membership.id,
    identityId: membership.identityId,
    tenantId: membership.tenantId,
    role: membership.role?.name ?? "MEMBER",
    status: membership.status,
    createdAt: membership.createdAt,
  };
}
