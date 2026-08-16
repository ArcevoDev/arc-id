import { create } from "zustand";
import type { User } from "@arcevo/facet-sdk";

export type { User };

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken?: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, accessToken, refreshToken) =>
    set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false }),

  setUser: (user) =>
    set((state) => ({
      user,
      // A user without a token isn't authenticated yet (e.g. post-register).
      isAuthenticated: state.isAuthenticated,
    })),

  setTokens: (accessToken, refreshToken) =>
    set((state) => ({
      accessToken,
      ...(refreshToken ? { refreshToken } : {}),
      // Receiving a token bundle means authentication succeeded.
      isAuthenticated: state.isAuthenticated || accessToken !== null,
    })),

  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  setLoading: (isLoading) => set({ isLoading }),
}));
