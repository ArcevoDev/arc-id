// src/store/auth.store.ts
// Single source of truth for authentication state.
// All auth side-effects (localStorage, redirects) live here — never in components.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authSdk } from "@/sdk/auth.sdk";
import { TOKEN_KEYS } from "@/sdk/client";

export interface AuthUser {
  id: string;
  name: string | null;
  primaryEmail: string | null;
  status: string;
  picture: string | null;
}

export interface LoginResult {
  success: boolean;
  requiresMfa: boolean;
  sessionId?: string;
  mfaTypes?: string[];
  error?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  currentSessionId: string | null; // ← NEW: stored so logout can send it
  isAuthenticated: boolean;
  isLoading: boolean;

  // actions
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  setTokens: (
    access: string,
    refresh: string,
    user?: AuthUser,
    sessionId?: string,
  ) => void;
  clearAuth: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      currentSessionId: null,
      isAuthenticated: false,
      isLoading: true,

      hydrate: () => {
        const token = localStorage.getItem(TOKEN_KEYS.access);
        const raw = localStorage.getItem(TOKEN_KEYS.user);
        const sessionId = localStorage.getItem(TOKEN_KEYS.session);
        if (token && raw) {
          try {
            const user = JSON.parse(raw) as AuthUser;
            set({
              user,
              accessToken: token,
              currentSessionId: sessionId,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch {
            get().clearAuth();
          }
        } else {
          set({ isLoading: false });
        }
      },

      login: async (email, password) => {
        try {
          const data = await authSdk.login(email, password);
          if (data.requiresMfa) {
            if (data.sessionId) {
              sessionStorage.setItem(TOKEN_KEYS.mfaState, data.sessionId);
            }
            return {
              success: true,
              requiresMfa: true,
              sessionId: data.sessionId,
              mfaTypes: data.mfaTypes,
            };
          }
          // FIX: pass sessionId from login response so logout can send it
          get().setTokens(
            data.accessToken,
            data.refreshToken,
            data.identity,
            data.sessionId,
          );
          return { success: true, requiresMfa: false };
        } catch (err: any) {
          return {
            success: false,
            requiresMfa: false,
            error: err.message ?? "Login failed",
          };
        }
      },

      logout: async () => {
        try {
          // FIX: was incorrectly sending the access token as sessionId.
          // Backend POST /auth/logout expects { sessionId }, not a JWT.
          const sessionId = get().currentSessionId;
          if (sessionId) await authSdk.logout(sessionId);
        } catch {
          /* best-effort — clear local state regardless */
        }
        get().clearAuth();
      },

      setTokens: (access, refresh, user, sessionId) => {
        localStorage.setItem(TOKEN_KEYS.access, access);
        localStorage.setItem(TOKEN_KEYS.refresh, refresh);
        if (user) localStorage.setItem(TOKEN_KEYS.user, JSON.stringify(user));
        if (sessionId) localStorage.setItem(TOKEN_KEYS.session, sessionId);
        set({
          accessToken: access,
          refreshToken: refresh,
          currentSessionId: sessionId ?? get().currentSessionId,
          user: user ?? get().user,
          isAuthenticated: true,
        });
      },

      clearAuth: () => {
        localStorage.removeItem(TOKEN_KEYS.access);
        localStorage.removeItem(TOKEN_KEYS.refresh);
        localStorage.removeItem(TOKEN_KEYS.user);
        localStorage.removeItem(TOKEN_KEYS.tenant);
        localStorage.removeItem(TOKEN_KEYS.session);
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          currentSessionId: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
    }),
    {
      name: "arcid-auth",
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        currentSessionId: s.currentSessionId,
        isAuthenticated: s.isAuthenticated,
      }),
    },
  ),
);
