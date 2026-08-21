"use client";

import { useCallback } from "react";
import { useAuthStore } from "@arcevo/facet-store";
import { oauth } from "@/sdk";
import type { CreateClientParams } from "@arcevo/facet-sdk";

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

  const createClient = useCallback(async (data: CreateClientParams) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return oauth.createClient(data);
  }, [accessToken]);

  const deleteClient = useCallback(async (clientId: string) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return oauth.deleteClient(clientId);
  }, [accessToken]);

  return { listClients, listTokens, revokeToken, createClient, deleteClient };
}
