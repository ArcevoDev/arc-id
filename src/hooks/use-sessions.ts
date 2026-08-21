"use client";

import { useCallback } from "react";
import { useAuthStore } from "@arcevo/facet-store";
import { auth } from "@/sdk";

export function useSessions() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const list = useCallback(async () => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return auth.listSessions();
  }, [accessToken]);

  const revoke = useCallback(async (sessionId: string) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return auth.revokeSession(sessionId);
  }, [accessToken]);

  return { list, revoke };
}
