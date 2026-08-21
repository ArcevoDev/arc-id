"use client";

import { useCallback } from "react";
import { useAuthStore } from "@arcevo/facet-store";
import { audit } from "@/sdk";
import type { AuditListParams } from "@/sdk";

export function useAuditLog() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const list = useCallback(
    async (params?: AuditListParams) => {
      if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
      return audit.list(params);
    },
    [accessToken],
  );

  return { list };
}
