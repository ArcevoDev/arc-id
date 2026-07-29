"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { auth } from "@/sdk";

export function useMfa() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const setup = useCallback(async () => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return auth.setupMfa();
  }, [accessToken]);

  const confirm = useCallback(async (code: string) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return auth.confirmMfa(code);
  }, [accessToken]);

  const disable = useCallback(async () => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return auth.disableMfa();
  }, [accessToken]);

  const verify = useCallback(async (code: string, sessionId: string) => {
    return auth.verifyMfa(code, sessionId);
  }, []);

  return { setup, confirm, disable, verify };
}
