"use client";

import { useRouter } from "next/navigation";
import type { User } from "@arcevo/facet-sdk";

/**
 * Decide where an authenticated user should land.
 *
 * - A user with at least one ACTIVE tenant membership (a dev/org user)
 *   goes to the console dashboard, which is tenant-scoped.
 * - A general user (no membership, or no tenant context) goes to the
 *   web-wallet view (their credentials / profile).
 *
 * The discriminator is real data from the auth response, not a guess.
 */
export function resolvePostAuthRoute(user?: User | null): string {
  if (!user) return "/login";

  const hasTenant = (user.memberships ?? []).some(
    (m) => m.status === "ACTIVE" || m.status === undefined || m.status === null,
  );
  const isAdmin = (user.roles ?? []).some(
    (r) => r === "ADMIN" || r === "SUPER_ADMIN" || r === "SYSTEM_ADMIN",
  );

  if (hasTenant || isAdmin) return "/dashboard";
  return "/wallet";
}

/** Redirect after login/register based on the resolved user type. */
export function usePostAuthRedirect() {
  const router = useRouter();
  return (user?: User | null) => router.replace(resolvePostAuthRoute(user));
}
