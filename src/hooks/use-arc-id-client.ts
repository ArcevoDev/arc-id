"use client";

import { arcIdClient } from "@/sdk";

/**
 * Access to the shared ArcIdClient singleton, kept behind a hook so
 * pages/components never import the SDK module directly (chain rule:
 * page -> component -> hook -> SDK -> API).
 */
export function useArcIdClient() {
  return arcIdClient;
}
