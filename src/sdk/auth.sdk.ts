import type { SdkClient } from "./client";

export function createAuthSdk(client: SdkClient) {
  return {
    login: (email: string, password: string) =>
      client.post<{ accessToken: string; refreshToken: string; user: any }>("/auth/login", {
        email,
        password,
      }),

    register: (name: string, email: string, password: string) =>
      client.post<{ accessToken: string; refreshToken: string; user: any }>("/auth/register", {
        name,
        email,
        password,
      }),

    /** POST /auth/logout — revoke a session. sessionId is required. */
    logout: (sessionId: string) =>
      client.post("/auth/logout", { sessionId }),

    /** GET /identity/profile — the authenticated user's profile with memberships */
    me: () =>
      client.get<{ id: string; email: string; name: string; memberships: any[]; plan: string; tenantId: string | null }>(
        "/identity/profile",
      ),

    /** POST /oauth/token with grant_type=refresh_token */
    refresh: (refreshToken: string) =>
      client.post<{ accessToken: string; refreshToken?: string }>("/oauth/token", {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),

    listSessions: () => client.get<any[]>("/auth/sessions"),

    revokeSession: (sessionId: string) =>
      client.delete(`/auth/sessions/${sessionId}`),

    /** POST /auth/password/reset — request a password reset email */
    forgotPassword: (email: string) =>
      client.post("/auth/password/reset", { email }),

    /** POST /auth/password/reset/confirm — consume token and set new password */
    resetPassword: (token: string, newPassword: string) =>
      client.post("/auth/password/reset/confirm", { token, newPassword }),

    /** POST /auth/email/verify — verify email with token */
    verifyEmail: (token: string) =>
      client.post("/auth/email/verify", { token }),

    /** POST /auth/mfa/verify — verify TOTP code during login (requires sessionId) */
    verifyMfa: (code: string, sessionId: string) =>
      client.post<{ accessToken: string; refreshToken: string; user: any }>("/auth/mfa/verify", {
        code,
        sessionId,
      }),

    /** POST /auth/mfa/setup — initialize TOTP setup, returns QR code */
    setupMfa: () =>
      client.post<{ secret: string; qrCode: string; uri: string }>("/auth/mfa/setup", {
        type: "TOTP",
      }),

    /** POST /auth/mfa/confirm — confirm MFA setup with first TOTP code */
    confirmMfa: (code: string) =>
      client.post<{ recoveryCodes: string[] }>("/auth/mfa/confirm", { code }),

    /**
     * DELETE /auth/mfa/disable — disable MFA.
     * Requires an elevated session (POST /auth/step-up must be called first).
     */
    disableMfa: () => client.delete("/auth/mfa/disable"),

    /** POST /auth/step-up — elevate session for privileged operations */
    stepUp: (method: "password" | "totp" | "passkey", sessionId: string, credential: Record<string, unknown>) =>
      client.post<{ success: true; elevatedUntil: string }>("/auth/step-up", {
        method,
        sessionId,
        ...credential,
      }),

  };
}
