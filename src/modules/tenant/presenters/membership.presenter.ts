import type { TenantMembership, Role, Identity } from "@/prisma-client";

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

// ── Member list view ──────────────────────────────────────────────────────
// Used by GET /tenants/:tenantId/members. Joins identity so the UI's
// <MemberRow> can render an email/name/avatar without a second round trip.
// See: arc/components proposal — `presentMembership` alone was missing
// email/name, which <MemberRow> needs.
type MembershipWithRoleAndIdentity = TenantMembership & {
  role: Pick<Role, "name">;
  identity: Pick<Identity, "id" | "primaryEmail" | "name" | "picture">;
};

export function presentMembershipWithIdentity(
  membership: MembershipWithRoleAndIdentity,
) {
  return {
    id: membership.id,
    identityId: membership.identityId,
    tenantId: membership.tenantId,
    role: membership.role.name,
    status: membership.status,
    createdAt: membership.createdAt,
    email: membership.identity.primaryEmail,
    name: membership.identity.name,
    picture: membership.identity.picture,
  };
}
