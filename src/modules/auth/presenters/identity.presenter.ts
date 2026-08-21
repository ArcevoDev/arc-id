import type { Identity, TenantMembership, Role } from "@prisma-client";

export type IdentityWithMemberships = Identity & {
  memberships?: (TenantMembership & { role: Role })[];
};

/** Auth-module convenience re-export — identical shape to identity module's canonical presenter. */
export function presentIdentity(identity: IdentityWithMemberships) {
  return {
    id: identity.id,
    email: identity.primaryEmail,
    name: identity.name,
    username: identity.username,
    picture: identity.picture,
    status: identity.status,
    emailVerified: identity.emailVerified,
    roles: identity.memberships?.map((m) => m.role.name) ?? [],
    metadata: identity.metadata,
    createdAt: identity.createdAt.toISOString(),
    updatedAt: identity.updatedAt.toISOString(),
  };
}
