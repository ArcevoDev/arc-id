"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { credentials } from "@/sdk";

export function useCredentials() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const list = useCallback(async () => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return credentials.list();
  }, [accessToken]);

  const verify = useCallback(async (credential: string) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return credentials.verify(credential);
  }, [accessToken]);

  const issue = useCallback(async (data: Record<string, unknown>) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return credentials.issue(data);
  }, [accessToken]);

  const offer = useCallback(async (data: Record<string, unknown>) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return credentials.offer(data);
  }, [accessToken]);

  const revoke = useCallback(async (credentialId: string) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return credentials.revoke(credentialId);
  }, [accessToken]);

  return { list, verify, issue, offer, revoke };
}
