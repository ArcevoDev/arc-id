"use client";

import { useCallback } from "react";
import { useAuthStore } from "@arcevo/facet-store";
import { identity } from "@/sdk";

export function useIdentities() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const list = useCallback(
    async (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
      if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
      return identity.list(params);
    },
    [accessToken],
  );

  const suspend = useCallback(
    async (id: string, reason?: string) => {
      if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
      return identity.suspend(id, reason);
    },
    [accessToken],
  );

  const reinstate = useCallback(
    async (id: string, reason?: string) => {
      if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
      return identity.reinstate(id, reason);
    },
    [accessToken],
  );

  return { list, suspend, reinstate };
}
