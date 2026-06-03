// src/modules/auth/presenters/identity.presenter.ts
import type { Identity } from "@/prisma-client";

export function presentIdentity(
  identity: Identity & { memberships?: Array<{ role: { name: string } }> }
) {
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