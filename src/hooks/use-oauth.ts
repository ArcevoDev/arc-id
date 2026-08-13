"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { oauth } from "@/sdk";

export function useOAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const listClients = useCallback(async () => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return oauth.listClients();
  }, [accessToken]);

  const listTokens = useCallback(async () => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return oauth.listTokens();
  }, [accessToken]);

  const revokeToken = useCallback(async (tokenId: string) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return oauth.revokeToken(tokenId);
  }, [accessToken]);

  return { listClients, listTokens, revokeToken };
}
