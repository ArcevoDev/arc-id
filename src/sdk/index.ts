/**
 * ArcID SDK - singleton wiring for @arcevo/facet-sdk.
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
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_OPTIONS,
} from "@/lib/refresh-cookies";

// ── Client singleton ─────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const AUTH_STORAGE_KEY = "arcid-session";

/** Persist the current user so AuthProvider can restore identity on page load. */
export function persistSession(user: User) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user }));
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
// again - recursing forever. The flag short-circuits the second entry so the
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
    if (refreshInFlight) return null;

    refreshInFlight = true;
    try {
      // The refresh token lives in an httpOnly cookie (set by the backend).
      // Pass an empty string — the /oauth/token endpoint reads from the
      // cookie when the body value is empty.
      const { data, error } = await authSdk.refresh("");
      if (error || !data?.accessToken) {
        onAuthCleared();
        return null;
      }

      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken ?? "");
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

// Re-export cookie constants (single source of truth: src/lib/refresh-cookies.ts).
export { REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS };

// Re-export shared types for consumers.
export type { AuditListParams, ApiError, ApiResponse };
