"use client";

import { useCallback } from "react";
import { useAuthStore } from "@arcevo/facet-store";
import { credentials } from "@/sdk";
import type { IssueCredentialParams } from "@arcevo/facet-sdk";

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

  const issue = useCallback(async (data: IssueCredentialParams) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return credentials.issue(data);
  }, [accessToken]);

  const offer = useCallback(async (data: { credentialId: string; expiresAt?: string }) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return credentials.offer(data);
  }, [accessToken]);

  const acceptOffer = useCallback(async (token: string) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return credentials.acceptOffer(token);
  }, [accessToken]);

  const revoke = useCallback(async (credentialId: string) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return credentials.revoke(credentialId);
  }, [accessToken]);

  return { list, verify, issue, offer, acceptOffer, revoke };
}
