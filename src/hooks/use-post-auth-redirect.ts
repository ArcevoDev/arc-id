"use client";

import { useRouter } from "next/navigation";
import type { User } from "@arcevo/facet-sdk";

/**
 * Decide where an authenticated user should land after login/register.
 *
 * All authenticated users go to the console (/console). The console
 * dashboard itself determines whether the user has a tenant context or
 * needs to create/join one. This replaces the old wallet redirect since
 * Arc-Wallet is now a separate standalone app.
 */
export function resolvePostAuthRoute(_user?: User | null): string {
  return "/console";
}

/** Redirect after login/register based on the resolved user type. */
export function usePostAuthRedirect() {
  const router = useRouter();
  return (_user?: User | null) => router.replace(resolvePostAuthRoute(_user));
}
