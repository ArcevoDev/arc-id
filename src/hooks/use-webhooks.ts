"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { webhooks } from "@/sdk";

export function useWebhooks() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const list = useCallback(async () => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return webhooks.list();
  }, [accessToken]);

  const create = useCallback(
    async (data: { url: string; eventTypes: string[]; secret?: string; enabled?: boolean }) => {
      if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
      return webhooks.create(data);
    },
    [accessToken],
  );

  const update = useCallback(
    async (id: string, data: { url?: string; eventTypes?: string[]; enabled?: boolean }) => {
      if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
      return webhooks.update(id, data);
    },
    [accessToken],
  );

  const remove = useCallback(async (id: string) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return webhooks.delete(id);
  }, [accessToken]);

  const test = useCallback(async (id: string) => {
    if (!accessToken) return { data: null, error: { statusCode: 401, error: "Unauthorized", message: "No access token" } as const };
    return webhooks.test(id);
  }, [accessToken]);

  return { list, create, update, remove, test };
}
