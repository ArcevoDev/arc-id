// src/sdk/auth.sdk.ts
import { sdk } from "./client";

export const authSdk = {
  login: (email: string, password: string) =>
    sdk.post<any>("/api/v1/auth/login", { email, password }),

  register: (name: string, email: string, password: string) =>
    sdk.post<any>("/api/v1/auth/register", { name, email, password }),

  // FIX: backend POST /auth/logout expects { sessionId: string }, not a token.
  // The store is also fixed to pass the sessionId (not the access token).
  logout: (sessionId: string) =>
    sdk.post<void>("/api/v1/auth/logout", { sessionId }),

  me: () => sdk.get<any>("/api/v1/identity/me"),

  refreshToken: (refreshToken: string) =>
    sdk.post<any>("/api/v1/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),

  verifyMfa: (code: string, sessionId: string) =>
    sdk.post<any>("/api/v1/auth/mfa/verify", { code, sessionId }),

  verifyMfaRecovery: (code: string, sessionId: string) =>
    sdk.post<any>("/api/v1/auth/mfa/recovery", { code, sessionId }),

  setupMfa: () => sdk.post<any>("/api/v1/auth/mfa/setup", { type: "TOTP" }),
  confirmMfa: (code: string) =>
    sdk.post<any>("/api/v1/auth/mfa/confirm", { code }),
  disableMfa: () => sdk.delete<any>("/api/v1/auth/mfa/disable"),

  forgotPassword: (email: string) =>
    sdk.post<void>("/api/v1/auth/password/reset/request", { email }),

  resetPassword: (token: string, password: string) =>
    sdk.post<void>("/api/v1/auth/password/reset/confirm", {
      token,
      newPassword: password,
    }),

  verifyEmail: (token: string) =>
    sdk.post<void>("/api/v1/auth/email/verify", { token }),

  listPasskeys: () => sdk.get<any[]>("/api/v1/auth/passkey"),
  deletePasskey: (id: string) => sdk.delete<void>(`/api/v1/auth/passkey/${id}`),

  listSessions: () => sdk.get<any[]>("/api/v1/auth/sessions"),
  revokeSession: (id: string) =>
    sdk.delete<void>(`/api/v1/auth/sessions/${id}`),

  // FIX: step-up endpoint is POST /auth/step-up with discriminated union body.
  // The SDK signature now reflects the actual route: { method, sessionId, password }.
  stepUp: (
    sessionId: string,
    method: "password" | "totp",
    credential: string,
  ) =>
    sdk.post<{ elevatedUntil: string }>("/api/v1/auth/step-up", {
      method,
      sessionId,
      ...(method === "password"
        ? { password: credential }
        : { totpCode: credential }),
    }),
};
