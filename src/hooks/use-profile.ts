"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { identity } from "@/sdk";
import type { JsonObject } from "@arcevo/facet-sdk";

export function useProfile() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const updateProfile = useCallback(
    async (data: { name?: string; picture?: string; metadata?: JsonObject }) => {
      if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
      return identity.updateProfile(data);
    },
    [accessToken],
  );

  const deleteAccount = useCallback(async () => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return identity.deleteAccount();
  }, [accessToken]);

  return { updateProfile, deleteAccount };
}
