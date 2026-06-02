import type { Identity, TenantMembership, Role } from "@/prisma-client";

type IdentityWithMemberships = Identity & {
  memberships?: (TenantMembership & { role: Role })[];
};

export function presentIdentity(identity: IdentityWithMemberships) {
  return {
    id: identity.id,
    email: identity.primaryEmail,
    name: identity.name,
    picture: identity.picture,
    status: identity.status,
    emailVerified: identity.emailVerified,
    roles: identity.memberships?.map((m) => m.role.name) ?? [],
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
  };
}
