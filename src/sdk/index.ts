/**
 * ArcID SDK — factory pattern singleton getters.
 *
 * Usage:
 *   import { auth, tenants } from "@/sdk";
 *   const { data, error } = await auth.login("...", "...");
 *
 * The SDK is fully typed. Responses are always { data: T | null, error: ApiError | null }.
 * Components never call fetch() directly.
 */

import { createSdkClient } from "./client";
import { createAuthSdk } from "./auth.sdk";
import { createBillingSdk } from "./billing.sdk";
import { createAuditSdk } from "./audit.sdk";
import { createTenantSdk } from "./tenant.sdk";
import { createCredentialsSdk } from "./credentials.sdk";
import { createIdentitySdk } from "./identity.sdk";
import { createOAuthSdk } from "./oauth.sdk";
import { createWebhookSdk } from "./webhooks.sdk";
import { createPasskeySdk } from "./passkey.sdk";
import { createIdpSdk } from "./idp.sdk";
import { useAuthStore } from "@/store/auth.store";

// ── Client singleton ─────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function getAccessToken() {
  return useAuthStore.getState().accessToken;
}

async function refreshToken(): Promise<string | null> {
  const state = useAuthStore.getState();
  if (!state.refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: state.refreshToken,
      }),
    });

    if (!res.ok) {
      useAuthStore.getState().clearAuth();
      return null;
    }

    const data = await res.json();
    const accessToken = data.access_token ?? data.accessToken;
    const newRefreshToken = data.refresh_token ?? data.refreshToken;
    useAuthStore.getState().setTokens(accessToken, newRefreshToken);
    return accessToken;
  } catch {
    useAuthStore.getState().clearAuth();
    return null;
  }
}

function onAuthCleared() {
  useAuthStore.getState().clearAuth();
  localStorage.removeItem("arcid-auth");
}

const client = createSdkClient({
  baseUrl: BASE_URL,
  getAccessToken,
  refreshToken,
  onAuthCleared,
});

// ── Domain SDKs ──────────────────────────────────────────────────────────────

export const auth = createAuthSdk(client);
export const tenants = createTenantSdk(client);
export const billing = createBillingSdk(client);
export const credentials = createCredentialsSdk(client);
export const audit = createAuditSdk(client);
export const identity = createIdentitySdk(client);
export const oauth = createOAuthSdk(client);
export const webhooks = createWebhookSdk(client);
export const passkeys = createPasskeySdk(client);
export const idp = createIdpSdk(client);

