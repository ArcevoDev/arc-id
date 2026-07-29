"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { auth } from "@/sdk";

export function useStepUp() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const execute = useCallback(
    async (method: "password" | "totp" | "passkey", sessionId: string, credential: Record<string, unknown>) => {
      if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
      return auth.stepUp(method, sessionId, credential);
    },
    [accessToken],
  );

  return { execute };
}
