import type { SdkClient } from "./client";

export function createPasskeySdk(client: SdkClient) {
  return {
    /** GET /auth/passkey — list registered passkeys for the current identity. */
    list: () => client.get<any[]>("/auth/passkey"),

    /** POST /auth/passkey/options/register — generate WebAuthn registration options. */
    registrationOptions: (data: { name: string }) =>
      client.post<any>("/auth/passkey/options/register", data),

    /** POST /auth/passkey/register — verify and persist a registered passkey. */
    register: (data: Record<string, unknown>) =>
      client.post<any>("/auth/passkey/register", data),

    /** POST /auth/passkey/options/authenticate — generate WebAuthn authentication options. */
    authenticationOptions: (sessionId?: string) =>
      client.post<any>("/auth/passkey/options/authenticate", sessionId ? { sessionId } : {}),

    /** POST /auth/passkey/authenticate — authenticate via passkey assertion. */
    authenticate: (data: Record<string, unknown>) =>
      client.post<any>("/auth/passkey/authenticate", data),

    /** DELETE /passkey/:passkeyId — deregister a passkey (requires step-up). */
    deregister: (passkeyId: string) =>
      client.delete(`/auth/passkey/${passkeyId}`),
  };
}

export type PasskeySdk = ReturnType<typeof createPasskeySdk>;
