"use client";

import type { TokenStorage } from "@arcevo/facet-auth";
import { useAuthStore } from "@arcevo/facet-store";
import { arcIdClient } from "@/sdk";

/**
 * Bridges @arcevo/facet-auth's ArcProvider to our Zustand auth store.
 *
 * facet-auth wants a TokenStorage for persistence; ours routes through
 * useAuthStore so the Zustand store stays the single source of truth
 * (auth store -> SDK client -> API convention is preserved).
 */
export const zustandTokenStorage: TokenStorage = {
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  setTokens: (accessToken, refreshToken) => {
    useAuthStore.getState().setTokens(accessToken, refreshToken);
    arcIdClient.setAccessToken(accessToken);
  },
  clearTokens: () => {
    useAuthStore.getState().clearAuth();
    arcIdClient.setAccessToken(null);
  },
};
