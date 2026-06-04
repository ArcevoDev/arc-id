"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth as authApi, getToken, clearToken, setToken, setRefreshToken } from "./api";

interface IdentityCtx {
  id: string;
  primaryEmail: string | null;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
  status: string;
}

interface AuthContextValue {
  identity: IdentityCtx | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<IdentityCtx | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getToken();
    if (t) {
      setTokenState(t);
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchProfile() {
    try {
      const { default: api } = await import("./api");
      const res = await (await import("./api")).identity.getProfile();
      setIdentity(res.data);
    } catch {
      clearToken();
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const res = await authApi.login({ email, password });
    const d = res.data;

    // If MFA pending, return the raw data so the caller can redirect
    if (d?.mfaRequired || d?.mfa_required) return { mfaRequired: true, sessionId: d.sessionId };

    const accessToken = d?.access_token ?? d?.accessToken ?? d?.token;
    const refreshToken = d?.refresh_token ?? d?.refreshToken;

    if (accessToken) {
      setToken(accessToken);
      setTokenState(accessToken);
      if (refreshToken) setRefreshToken(refreshToken);
      await fetchProfile();
    }

    return d;
  }

  async function logout() {
    clearToken();
    setIdentity(null);
    setTokenState(null);
  }

  async function refresh() {
    await fetchProfile();
  }

  return (
    <AuthContext.Provider value={{ identity, token, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
