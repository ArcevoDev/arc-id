"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { auth, arcIdClient, persistSession, clearPersistedSession } from "@/sdk";

export function useAuth() {
  const { user, isAuthenticated, isLoading, accessToken } = useAuthStore();

  const login = useCallback(async (email: string, password: string) => {
    const result = await auth.login(email, password);
    if (result.data) {
      // MFA-required logins return only sessionId + identity (no tokens).
      if (result.data.accessToken) {
        useAuthStore.getState().setAuth(result.data.identity, result.data.accessToken, result.data.refreshToken ?? "");
        arcIdClient.setAccessToken(result.data.accessToken);
        persistSession(
          result.data.identity,
          result.data.accessToken,
          result.data.refreshToken ?? "",
        );
      }
    }
    return result;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await auth.register(name, email, password);
    if (result.data) {
      // Registration returns only the identity (no tokens) in facet-sdk.
      useAuthStore.getState().setUser(result.data.identity);
    }
    return result;
  }, []);

  const logout = useCallback(async (sessionId: string) => {
    await auth.logout(sessionId);
    arcIdClient.setAccessToken(null);
    useAuthStore.getState().clearAuth();
    clearPersistedSession();
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    return auth.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    return auth.resetPassword(token, newPassword);
  }, []);

  const verifyEmail = useCallback(async (token: string) => {
    return auth.verifyEmail(token);
  }, []);

  const verifyMfa = useCallback(async (code: string, sessionId: string) => {
    const result = await auth.verifyMfa(code, sessionId);
    if (result.data) {
      // verifyMfa returns a TokenBundle: { sessionId, accessToken, refreshToken, idToken, expiresIn }.
      const { accessToken, refreshToken } = result.data;
      // Fetch the full profile so the store has both user + tokens.
      const me = await auth.me();
      if (me.data) {
        useAuthStore.getState().setAuth(me.data, accessToken, refreshToken);
        persistSession(me.data, accessToken, refreshToken);
      } else {
        useAuthStore.getState().setTokens(accessToken, refreshToken);
      }
      arcIdClient.setAccessToken(accessToken);
    }
    return result;
  }, []);

  const refreshAuth = useCallback(async () => {
    const state = useAuthStore.getState();
    if (!state.refreshToken) return;
    const result = await auth.refresh(state.refreshToken);
    if (result.data) {
      useAuthStore.getState().setTokens(result.data.accessToken, result.data.refreshToken);
      arcIdClient.setAccessToken(result.data.accessToken);
      if (state.user) {
        persistSession(state.user, result.data.accessToken, result.data.refreshToken ?? state.refreshToken);
      }
    } else {
      arcIdClient.setAccessToken(null);
      useAuthStore.getState().clearAuth();
      clearPersistedSession();
    }
  }, []);

  const requestMagicLink = useCallback(async (email: string) => {
    return auth.requestMagicLink(email);
  }, []);

  const authenticateMagicLink = useCallback(async (token: string) => {
    const result = await auth.authenticateMagicLink(token);
    if (result.data?.accessToken) {
      const { identity, accessToken, refreshToken } = result.data;
      useAuthStore.getState().setAuth(identity, accessToken, refreshToken ?? "");
      arcIdClient.setAccessToken(accessToken);
      persistSession(identity, accessToken, refreshToken ?? "");
    }
    return result;
  }, []);

  /** Drop the persisted session on disk (delete-account / hard logout). */
  const clearSession = useCallback(() => {
    arcIdClient.setAccessToken(null);
    useAuthStore.getState().clearAuth();
    clearPersistedSession();
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    accessToken,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    verifyEmail,
    verifyMfa,
    refreshAuth,
    requestMagicLink,
    authenticateMagicLink,
    clearSession,
  };
}

/** OAuth social login URL against the ArcID API. */
export function socialAuthUrl(provider: "google" | "github") {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  return `${base}/auth/${provider}`;
}
