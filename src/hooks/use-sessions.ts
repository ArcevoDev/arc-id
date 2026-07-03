// src/hooks/use-sessions.ts
// Pages → hooks → sdk. Wraps authSdk.listSessions + revokeSession.
// Follows the same pattern as use-audit.ts and use-oauth-tokens.ts.
"use client";
import { useState, useEffect, useCallback } from "react";
import { authSdk, SdkError } from "@/sdk";

export interface Session {
  id: string;
  userAgent: string | null;
  ip: string | null;
  valid: boolean;
  authLevel: string | null;
  createdAt: string;
  expiresAt: string;
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authSdk.listSessions();
      setSessions(Array.isArray(data) ? data : ((data as any)?.data ?? []));
    } catch (err) {
      setError(
        err instanceof SdkError ? err.message : "Failed to load sessions",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = useCallback(
    async (id: string) => {
      await authSdk.revokeSession(id);
      await load();
    },
    [load],
  );

  return { sessions, loading, error, refresh: load, revoke };
}
