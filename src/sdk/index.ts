/**
 * ArcID SDK — singleton wiring for @arcevo/facet-sdk.
 *
 * The domain SDKs live in the published `@arcevo/facet-sdk` package
 * (class-based: `new AuthSdk(client)`). This module owns the single
 * `ArcIdClient` instance, wired to the Zustand auth store for token
 * refresh + auth-cleared handling, and re-exports the domain SDKs as
 * singletons so consumers keep the same `import { auth } from "@/sdk"` API.
 */

import {
  ArcIdClient,
  AuthSdk,
  BillingSdk,
  AuditSdk,
  TenantSdk,
  VcSdk,
  IdentitySdk,
  OAuthSdk,
  WebhooksSdk,
  PasskeySdk,
  IdpSdk,
  type AuditListParams,
  type ApiError,
  type ApiResponse,
  type User,
} from "@arcevo/facet-sdk";
import { useAuthStore, useTenantStore } from "@arcevo/facet-store";

// ── Client singleton ─────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const AUTH_STORAGE_KEY = "arcid-auth";

/** Persist the current session so AuthProvider can restore it on page load. */
export function persistSession(user: User, accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ user, accessToken, refreshToken }),
  );
}

/** Remove the persisted session (logout, refresh failure, auth cleared). */
export function clearPersistedSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function onAuthCleared() {
  useAuthStore.getState().clearAuth();
  useTenantStore.getState().reset();
  clearPersistedSession();
}

// Re-entrancy guard: the client's request() retries with a fresh token after
// onTokenRefresh resolves, but the refresh call itself goes through the same
// client. If POST /oauth/token ever 401s, request() would call onTokenRefresh
// again — recursing forever. The flag short-circuits the second entry so the
// original failure path (onAuthCleared) runs instead.
let refreshInFlight = false;

// Declared before `client` to break the circular type dependency:
// client → onTokenRefresh → authSdk → client.
// `authSdk` is assigned after `client` is created; onTokenRefresh only runs
// at call-time, well after both are initialised.
let authSdk: AuthSdk;

const client: ArcIdClient = new ArcIdClient({
  baseUrl: BASE_URL,
  onTokenRefresh: async (): Promise<string | null> => {
    const state = useAuthStore.getState();
    if (!state.refreshToken || refreshInFlight) return null;

    refreshInFlight = true;
    try {
      const { data, error } = await authSdk.refresh(state.refreshToken);
      if (error || !data?.accessToken) {
        onAuthCleared();
        return null;
      }

      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } finally {
      refreshInFlight = false;
    }
  },
  onAuthCleared,
});

// ── Domain SDKs (facet-sdk classes) ─────────────────────────────────────────

authSdk = new AuthSdk(client);

export const auth = authSdk;
export const tenants = new TenantSdk(client);
export const billing = new BillingSdk(client);
export const credentials = new VcSdk(client);
export const audit = new AuditSdk(client);
export const identity = new IdentitySdk(client);
export const oauth = new OAuthSdk(client);
export const webhooks = new WebhooksSdk(client);
export const passkeys = new PasskeySdk(client);
export const idp = new IdpSdk(client);

// Re-export the client so providers can push token updates.
export const arcIdClient = client;

// Re-export shared types for consumers.
export type { AuditListParams, ApiError, ApiResponse };
