import type { Identity } from "@/prisma-client";

/** Safe public shape — strips all auth secrets before sending to client */
// Note: You will need to change the type input to include memberships
export function presentIdentity(identity: Identity & { memberships?: any[] }) {
  return {
    id: identity.id,
    email: identity.primaryEmail,
    name: identity.name,
    picture: identity.picture,
    status: identity.status,
    emailVerified: identity.emailVerified,
    // Extract role names from the membership relations
    roles: identity.memberships?.map((m) => m.role.name) ?? [],
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
  };
}
