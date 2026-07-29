"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { auth } from "@/sdk";

export function useAuth() {
  const { user, isAuthenticated, isLoading, accessToken } = useAuthStore();

  const login = useCallback(async (email: string, password: string) => {
    const result = await auth.login(email, password);
    if (result.data) {
      useAuthStore.getState().setAuth(result.data.user, result.data.accessToken, result.data.refreshToken);
    }
    return result;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await auth.register(name, email, password);
    if (result.data) {
      useAuthStore.getState().setAuth(result.data.user, result.data.accessToken, result.data.refreshToken);
    }
    return result;
  }, []);

  const logout = useCallback(async (sessionId: string) => {
    await auth.logout(sessionId);
    useAuthStore.getState().clearAuth();
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
      useAuthStore.getState().setAuth(result.data.user, result.data.accessToken, result.data.refreshToken);
    }
    return result;
  }, []);

  const refreshAuth = useCallback(async () => {
    const state = useAuthStore.getState();
    if (!state.refreshToken) return;
    const result = await auth.refresh(state.refreshToken);
    if (result.data) {
      useAuthStore.getState().setTokens(result.data.accessToken, result.data.refreshToken);
    } else {
      useAuthStore.getState().clearAuth();
    }
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
  };
}
