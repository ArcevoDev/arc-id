// src/hooks/use-passkeys.ts
// Pages → hooks → sdk. Wraps authSdk.listPasskeys + deletePasskey.
// This file was corrupted in the snapshot (contained sessions page code).
"use client";
import { useState, useEffect, useCallback } from "react";
import { authSdk, SdkError } from "@/sdk";

export interface Passkey {
  id: string;
  name: string | null;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string;
}

export function usePasskeys() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authSdk.listPasskeys();
      setPasskeys(Array.isArray(data) ? data : ((data as any)?.data ?? []));
    } catch (err) {
      setError(
        err instanceof SdkError ? err.message : "Failed to load passkeys",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = useCallback(
    async (id: string) => {
      await authSdk.deletePasskey(id);
      await load();
    },
    [load],
  );

  return { passkeys, loading, error, refresh: load, remove };
}
