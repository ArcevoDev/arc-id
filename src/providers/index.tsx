"use client";

import { ArcProvider } from "@arcevo/facet-auth";
import { ThemeProvider } from "@/providers/theme-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { zustandTokenStorage } from "@/providers/facet-auth-bridge";
import { arcIdClient, persistSession, clearPersistedSession } from "@/sdk";
import { useAuthStore } from "@arcevo/facet-store";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ArcProvider
        client={arcIdClient}
        storage={zustandTokenStorage}
        onSessionRestore={(user) => {
          // Keep the Zustand store's user in sync when ArcProvider restores
          // or resolves a session (login, magic link, social, refresh).
          const state = useAuthStore.getState();
          if (!state.user) state.setUser(user);
        }}
        onAuthChange={({ user, isAuthenticated }) => {
          if (isAuthenticated && user) {
            useAuthStore.getState().setUser(user);
            const { accessToken, refreshToken } = useAuthStore.getState();
            if (accessToken) {
              persistSession(user, accessToken, refreshToken ?? "");
            }
          } else if (!isAuthenticated) {
            useAuthStore.getState().clearAuth();
            clearPersistedSession();
          }
        }}
      >
        <AuthProvider>{children}</AuthProvider>
      </ArcProvider>
    </ThemeProvider>
  );
}
