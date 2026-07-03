// src/hooks/use-oauth-tokens.ts
// Pages → hooks → sdk. Wraps oauthSdk.listTokens/revokeTokenById.
//
// SHAPE FIX: presentActiveToken (src/modules/oauth/presenters/token.presenter.ts)
// returns { id, clientName, scopes, issuedAt, expiresAt, revoked } — it never
// returns a raw token value or a `clientId`/`createdAt` field. The previous
// page-local `Token` interface had `clientId`/`createdAt`, which don't exist
// on the actual response; this hook's `ActiveToken` type matches the real
// presenter output.
"use client";
import { useState, useEffect, useCallback } from "react";
import { oauthSdk, SdkError } from "@/sdk";

export interface ActiveToken {
  id: string;
  clientName: string;
  scopes: string[];
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
}

export function useOAuthTokens() {
  const [tokens, setTokens] = useState<ActiveToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await oauthSdk.listTokens();
      setTokens(Array.isArray(data) ? data : ((data as any)?.data ?? []));
    } catch (err) {
      setError(err instanceof SdkError ? err.message : "Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = useCallback(
    async (id: string) => {
      await oauthSdk.revokeTokenById(id);
      await load();
    },
    [load],
  );

  return { tokens, loading, error, refresh: load, revoke };
}
