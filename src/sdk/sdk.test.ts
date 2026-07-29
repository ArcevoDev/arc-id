import { describe, it, expect, vi } from "vitest";
import { createSdkClient, type SdkClient } from "./client";

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockClient(): { calls: Array<[string, string, unknown?]>; client: SdkClient } {
  const calls: Array<[string, string, unknown?]> = [];

  const client = createSdkClient({
    baseUrl: "http://test:4000/api/v1",
    getAccessToken: () => "test-token",
  });

  // Override all methods with call-tracking wrappers
  client.get = vi.fn((path: string) => {
    calls.push(["GET", path, undefined]);
    return Promise.resolve({ data: null, error: null });
  }) as any;

  client.post = vi.fn((path: string, body?: unknown) => {
    calls.push(["POST", path, body]);
    return Promise.resolve({ data: null, error: null });
  }) as any;

  client.patch = vi.fn((path: string, body?: unknown) => {
    calls.push(["PATCH", path, body]);
    return Promise.resolve({ data: null, error: null });
  }) as any;

  client.put = vi.fn((path: string, body?: unknown) => {
    calls.push(["PUT", path, body]);
    return Promise.resolve({ data: null, error: null });
  }) as any;

  client.delete = vi.fn((path: string) => {
    calls.push(["DELETE", path, undefined]);
    return Promise.resolve({ data: null, error: null });
  }) as any;

  return { calls, client };
}

// ── auth.sdk.ts ─────────────────────────────────────────────────────────────

describe("auth.sdk", () => {
  it("login: POST /auth/login", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.login("a@b.com", "pass123");
    expect(calls[0]).toEqual(["POST", "/auth/login", { email: "a@b.com", password: "pass123" }]);
  });

  it("register: POST /auth/register", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.register("Alice", "a@b.com", "pass123");
    expect(calls[0]).toEqual(["POST", "/auth/register", { name: "Alice", email: "a@b.com", password: "pass123" }]);
  });

  it("me: GET /identity/profile", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.me();
    expect(calls[0]).toEqual(["GET", "/identity/profile", undefined]);
  });

  it("forgotPassword: POST /auth/password/reset", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.forgotPassword("a@b.com");
    expect(calls[0]).toEqual(["POST", "/auth/password/reset", { email: "a@b.com" }]);
  });

  it("resetPassword: POST /auth/password/reset/confirm", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.resetPassword("tok", "newPass1");
    expect(calls[0]).toEqual(["POST", "/auth/password/reset/confirm", { token: "tok", newPassword: "newPass1" }]);
  });

  it("verifyEmail: POST /auth/email/verify", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.verifyEmail("vtok");
    expect(calls[0]).toEqual(["POST", "/auth/email/verify", { token: "vtok" }]);
  });

  it("verifyMfa: POST /auth/mfa/verify with code + sessionId", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.verifyMfa("123456", "sid123");
    expect(calls[0]).toEqual(["POST", "/auth/mfa/verify", { code: "123456", sessionId: "sid123" }]);
  });

  it("setupMfa: POST /auth/mfa/setup with type TOTP", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.setupMfa();
    expect(calls[0]).toEqual(["POST", "/auth/mfa/setup", { type: "TOTP" }]);
  });

  it("confirmMfa: POST /auth/mfa/confirm with code", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.confirmMfa("654321");
    expect(calls[0]).toEqual(["POST", "/auth/mfa/confirm", { code: "654321" }]);
  });

  it("disableMfa: DELETE /auth/mfa/disable", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.disableMfa();
    expect(calls[0]).toEqual(["DELETE", "/auth/mfa/disable", undefined]);
  });

  it("refresh: POST /oauth/token with grant_type=refresh_token", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.refresh("rtok");
    expect(calls[0]).toEqual(["POST", "/oauth/token", { grant_type: "refresh_token", refresh_token: "rtok" }]);
  });

  it("listSessions: GET /auth/sessions", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.listSessions();
    expect(calls[0]).toEqual(["GET", "/auth/sessions", undefined]);
  });

  it("revokeSession: DELETE /auth/sessions/:id", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.revokeSession("sess-1");
    expect(calls[0]).toEqual(["DELETE", "/auth/sessions/sess-1", undefined]);
  });
});

// ── audit.sdk.ts ────────────────────────────────────────────────────────────

describe("audit.sdk", () => {
  it("list: GET /audit/logs", async () => {
    const { createAuditSdk } = await import("./audit.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuditSdk(client);
    await sdk.list();
    expect(calls[0]).toEqual(["GET", "/audit/logs", undefined]);
  });

  it("list: includes query params", async () => {
    const { createAuditSdk } = await import("./audit.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuditSdk(client);
    await sdk.list({ action: "USER_LOGIN_SUCCESS", page: 2, limit: 50 });
    expect(calls[0]?.[1]).toContain("/audit/logs?action=USER_LOGIN_SUCCESS&page=2&limit=50");
  });

  it("list: includes identityId, from, to", async () => {
    const { createAuditSdk } = await import("./audit.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuditSdk(client);
    await sdk.list({ identityId: "id1", from: "2026-01-01T00:00:00Z", to: "2026-07-01T00:00:00Z" });
    expect(calls[0]?.[1]).toContain("identityId=id1");
    expect(calls[0]?.[1]).toContain("from=2026-01-01");
    expect(calls[0]?.[1]).toContain("to=2026-07-01");
  });
});

// ── billing.sdk.ts ──────────────────────────────────────────────────────────

describe("billing.sdk", () => {
  it("getSubscription: GET /billing/subscription", async () => {
    const { createBillingSdk } = await import("./billing.sdk");
    const { calls, client } = mockClient();
    const sdk = createBillingSdk(client);
    await sdk.getSubscription();
    expect(calls[0]).toEqual(["GET", "/billing/subscription", undefined]);
  });
});

// ── credentials.sdk.ts ──────────────────────────────────────────────────────

describe("credentials.sdk", () => {
  it("verify: POST /credentials/verify with credential", async () => {
    const { createCredentialsSdk } = await import("./credentials.sdk");
    const { calls, client } = mockClient();
    const sdk = createCredentialsSdk(client);
    await sdk.verify("vc-jwt");
    expect(calls[0]).toEqual(["POST", "/credentials/verify", { credential: "vc-jwt" }]);
  });

  it("issue: POST /credentials/issue", async () => {
    const { createCredentialsSdk } = await import("./credentials.sdk");
    const { calls, client } = mockClient();
    const sdk = createCredentialsSdk(client);
    await sdk.issue({ subjectDid: "did:key:abc", claims: { name: "Alice" } });
    expect(calls[0]).toEqual(["POST", "/credentials/issue", { subjectDid: "did:key:abc", claims: { name: "Alice" } }]);
  });

  it("offer: POST /credentials/offers", async () => {
    const { createCredentialsSdk } = await import("./credentials.sdk");
    const { calls, client } = mockClient();
    const sdk = createCredentialsSdk(client);
    await sdk.offer({ subjectDid: "did:key:abc" });
    expect(calls[0]).toEqual(["POST", "/credentials/offers", { subjectDid: "did:key:abc" }]);
  });

  it("revoke: POST /credentials/revoke with credentialId in body", async () => {
    const { createCredentialsSdk } = await import("./credentials.sdk");
    const { calls, client } = mockClient();
    const sdk = createCredentialsSdk(client);
    await sdk.revoke("uuid-1234");
    expect(calls[0]).toEqual(["POST", "/credentials/revoke", { credentialId: "uuid-1234" }]);
  });
});

// ── identity.sdk.ts ─────────────────────────────────────────────────────────

describe("identity.sdk", () => {
  it("list: GET /identity/admin with query params", async () => {
    const { createIdentitySdk } = await import("./identity.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdentitySdk(client);
    await sdk.list({ search: "alice", status: "ACTIVE" });
    expect(calls[0]?.[1]).toContain("/identity/admin?search=alice&status=ACTIVE");
  });

  it("suspend: POST /identity/admin/:id/suspend with reason", async () => {
    const { createIdentitySdk } = await import("./identity.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdentitySdk(client);
    await sdk.suspend("id-1", "bad behavior");
    expect(calls[0]).toEqual(["POST", "/identity/admin/id-1/suspend", { reason: "bad behavior" }]);
  });

  it("reinstate: PATCH /identity/:id/status with ACTIVE", async () => {
    const { createIdentitySdk } = await import("./identity.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdentitySdk(client);
    await sdk.reinstate("id-1");
    expect(calls[0]).toEqual(["PATCH", "/identity/id-1/status", { status: "ACTIVE" }]);
  });

  it("reinstate includes reason when provided", async () => {
    const { createIdentitySdk } = await import("./identity.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdentitySdk(client);
    await sdk.reinstate("id-1", "Appeal approved");
    expect(calls[0]).toEqual(["PATCH", "/identity/id-1/status", { status: "ACTIVE", reason: "Appeal approved" }]);
  });
});

// ── tenant.sdk.ts ───────────────────────────────────────────────────────────

describe("tenant.sdk", () => {
  it("get: GET /tenants/:slug", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.get("acme");
    expect(calls[0]).toEqual(["GET", "/tenants/acme", undefined]);
  });

  it("create: POST /tenants", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.create({ name: "Acme", slug: "acme" });
    expect(calls[0]).toEqual(["POST", "/tenants", { name: "Acme", slug: "acme" }]);
  });

  it("switchTenant: POST /auth/switch-context with tenantId in body", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.switchTenant("cuid123");
    expect(calls[0]).toEqual(["POST", "/auth/switch-context", { tenantId: "cuid123" }]);
  });
});

// ── webhooks.sdk.ts ─────────────────────────────────────────────────────────

describe("webhooks.sdk", () => {
  it("list: GET /webhooks/endpoints", async () => {
    const { createWebhookSdk } = await import("./webhooks.sdk");
    const { calls, client } = mockClient();
    const sdk = createWebhookSdk(client);
    await sdk.list();
    expect(calls[0]).toEqual(["GET", "/webhooks/endpoints", undefined]);
  });

  it("create: POST /webhooks/endpoints", async () => {
    const { createWebhookSdk } = await import("./webhooks.sdk");
    const { calls, client } = mockClient();
    const sdk = createWebhookSdk(client);
    await sdk.create({ url: "https://hook.example.com", events: ["USER_REGISTERED"] });
    expect(calls[0]).toEqual(["POST", "/webhooks/endpoints", { url: "https://hook.example.com", events: ["USER_REGISTERED"] }]);
  });

  it("update: PATCH /webhooks/endpoints/:id", async () => {
    const { createWebhookSdk } = await import("./webhooks.sdk");
    const { calls, client } = mockClient();
    const sdk = createWebhookSdk(client);
    await sdk.update("ep-1", { enabled: false });
    expect(calls[0]).toEqual(["PATCH", "/webhooks/endpoints/ep-1", { enabled: false }]);
  });

  it("delete: DELETE /webhooks/endpoints/:id", async () => {
    const { createWebhookSdk } = await import("./webhooks.sdk");
    const { calls, client } = mockClient();
    const sdk = createWebhookSdk(client);
    await sdk.delete("ep-1");
    expect(calls[0]).toEqual(["DELETE", "/webhooks/endpoints/ep-1", undefined]);
  });

  it("test: POST /webhooks/endpoints/:id/test", async () => {
    const { createWebhookSdk } = await import("./webhooks.sdk");
    const { calls, client } = mockClient();
    const sdk = createWebhookSdk(client);
    await sdk.test("ep-1");
    expect(calls[0]).toEqual(["POST", "/webhooks/endpoints/ep-1/test", undefined]);
  });
});

// ── oauth.sdk.ts ────────────────────────────────────────────────────────────

describe("oauth.sdk", () => {
  it("listClients: GET /oauth/clients", async () => {
    const { createOAuthSdk } = await import("./oauth.sdk");
    const { calls, client } = mockClient();
    const sdk = createOAuthSdk(client);
    await sdk.listClients();
    expect(calls[0]).toEqual(["GET", "/oauth/clients", undefined]);
  });

  it("createClient: POST /oauth/clients", async () => {
    const { createOAuthSdk } = await import("./oauth.sdk");
    const { calls, client } = mockClient();
    const sdk = createOAuthSdk(client);
    await sdk.createClient({ name: "App", redirectUris: ["http://localhost:3000/cb"] });
    expect(calls[0]).toEqual(["POST", "/oauth/clients", { name: "App", redirectUris: ["http://localhost:3000/cb"] }]);
  });

  it("deleteClient: DELETE /oauth/clients/:clientId", async () => {
    const { createOAuthSdk } = await import("./oauth.sdk");
    const { calls, client } = mockClient();
    const sdk = createOAuthSdk(client);
    await sdk.deleteClient("cid-1");
    expect(calls[0]).toEqual(["DELETE", "/oauth/clients/cid-1", undefined]);
  });

  it("listTokens: GET /oauth/tokens", async () => {
    const { createOAuthSdk } = await import("./oauth.sdk");
    const { calls, client } = mockClient();
    const sdk = createOAuthSdk(client);
    await sdk.listTokens();
    expect(calls[0]).toEqual(["GET", "/oauth/tokens", undefined]);
  });

  it("revokeToken: DELETE /oauth/tokens/:id", async () => {
    const { createOAuthSdk } = await import("./oauth.sdk");
    const { calls, client } = mockClient();
    const sdk = createOAuthSdk(client);
    await sdk.revokeToken("tok-1");
    expect(calls[0]).toEqual(["DELETE", "/oauth/tokens/tok-1", undefined]);
  });
});

// ── tenant.sdk.ts — additions ───────────────────────────────────────────────

describe("tenant.sdk — added methods", () => {
  it("list: GET /tenants", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.list();
    expect(calls[0]).toEqual(["GET", "/tenants", undefined]);
  });

  it("listMembers: GET /tenants/:tenantId/members", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.listMembers("tnt-1");
    expect(calls[0]).toEqual(["GET", "/tenants/tnt-1/members", undefined]);
  });

  it("addMember: POST /tenants/:tenantId/members", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.addMember("tnt-1", { identityId: "id-1", roleId: "role-1" });
    expect(calls[0]).toEqual(["POST", "/tenants/tnt-1/members", { identityId: "id-1", roleId: "role-1" }]);
  });

  it("removeMember: DELETE /tenants/:tenantId/members/:identityId", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.removeMember("tnt-1", "id-1");
    expect(calls[0]).toEqual(["DELETE", "/tenants/tnt-1/members/id-1", undefined]);
  });

  it("getPolicy: GET /tenants/:tenantId/policy", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.getPolicy("tnt-1");
    expect(calls[0]).toEqual(["GET", "/tenants/tnt-1/policy", undefined]);
  });

  it("updatePolicy: PATCH /tenants/:tenantId/policy", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.updatePolicy("tnt-1", { requireMfa: true });
    expect(calls[0]).toEqual(["PATCH", "/tenants/tnt-1/policy", { requireMfa: true }]);
  });

  it("acceptInvite: POST /tenants/invites/accept", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.acceptInvite({ token: "inv-tok" });
    expect(calls[0]).toEqual(["POST", "/tenants/invites/accept", { token: "inv-tok" }]);
  });

  it("getDid: GET /tenants/:tenantId/did", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.getDid("tnt-1");
    expect(calls[0]).toEqual(["GET", "/tenants/tnt-1/did", undefined]);
  });

  it("provisionDid: POST /tenants/:tenantId/did", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.provisionDid("tnt-1", { domain: "example.com" });
    expect(calls[0]).toEqual(["POST", "/tenants/tnt-1/did", { domain: "example.com" }]);
  });

  it("listSigningKeys: GET /tenants/:tenantId/signing-keys", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.listSigningKeys("tnt-1");
    expect(calls[0]).toEqual(["GET", "/tenants/tnt-1/signing-keys", undefined]);
  });

  it("revokeSigningKey: DELETE /tenants/:tenantId/signing-keys/:kid", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.revokeSigningKey("tnt-1", "kid-1");
    expect(calls[0]).toEqual(["DELETE", "/tenants/tnt-1/signing-keys/kid-1", undefined]);
  });

  it("listProjects: GET /tenants/:tenantId/projects", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.listProjects("tnt-1");
    expect(calls[0]).toEqual(["GET", "/tenants/tnt-1/projects", undefined]);
  });

  it("createProject: POST /tenants/:tenantId/projects", async () => {
    const { createTenantSdk } = await import("./tenant.sdk");
    const { calls, client } = mockClient();
    const sdk = createTenantSdk(client);
    await sdk.createProject("tnt-1", { name: "My Project" });
    expect(calls[0]).toEqual(["POST", "/tenants/tnt-1/projects", { name: "My Project" }]);
  });
});

// ── auth.sdk.ts — added methods ─────────────────────────────────────────────

describe("auth.sdk — added methods", () => {
  it("mfaRecovery: POST /auth/mfa/recovery with code + sessionId", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.mfaRecovery("rec-code", "sid-1");
    expect(calls[0]).toEqual(["POST", "/auth/mfa/recovery", { code: "rec-code", sessionId: "sid-1" }]);
  });

  it("changePassword: POST /auth/password/change", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.changePassword("oldPass1", "newPass2");
    expect(calls[0]).toEqual(["POST", "/auth/password/change", { currentPassword: "oldPass1", newPassword: "newPass2" }]);
  });

  it("requestMagicLink: POST /auth/magic-link/request", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.requestMagicLink("a@b.com");
    expect(calls[0]).toEqual(["POST", "/auth/magic-link/request", { email: "a@b.com" }]);
  });

  it("authenticateMagicLink: POST /auth/magic-link with token", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.authenticateMagicLink("ml-tok");
    expect(calls[0]).toEqual(["POST", "/auth/magic-link", { token: "ml-tok" }]);
  });

  it("setUsername: PATCH /auth/username", async () => {
    const { createAuthSdk } = await import("./auth.sdk");
    const { calls, client } = mockClient();
    const sdk = createAuthSdk(client);
    await sdk.setUsername("Alice");
    expect(calls[0]).toEqual(["PATCH", "/auth/username", { name: "Alice" }]);
  });
});

// ── identity.sdk.ts — added methods ─────────────────────────────────────────

describe("identity.sdk — added methods", () => {
  it("updateProfile: PATCH /identity/profile", async () => {
    const { createIdentitySdk } = await import("./identity.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdentitySdk(client);
    await sdk.updateProfile({ name: "Alice", displayName: "Alice" });
    expect(calls[0]).toEqual(["PATCH", "/identity/profile", { name: "Alice", displayName: "Alice" }]);
  });

  it("deleteAccount: DELETE /identity/profile", async () => {
    const { createIdentitySdk } = await import("./identity.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdentitySdk(client);
    await sdk.deleteAccount();
    expect(calls[0]).toEqual(["DELETE", "/identity/profile", undefined]);
  });

  it("listDevices: GET /identity/devices", async () => {
    const { createIdentitySdk } = await import("./identity.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdentitySdk(client);
    await sdk.listDevices();
    expect(calls[0]).toEqual(["GET", "/identity/devices", undefined]);
  });

  it("deleteDevice: DELETE /identity/devices/:id", async () => {
    const { createIdentitySdk } = await import("./identity.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdentitySdk(client);
    await sdk.deleteDevice("dev-1");
    expect(calls[0]).toEqual(["DELETE", "/identity/devices/dev-1", undefined]);
  });

  it("listLinkedAccounts: GET /identity/linked-accounts", async () => {
    const { createIdentitySdk } = await import("./identity.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdentitySdk(client);
    await sdk.listLinkedAccounts();
    expect(calls[0]).toEqual(["GET", "/identity/linked-accounts", undefined]);
  });

  it("unlinkLinkedAccount: DELETE /identity/linked-accounts/:id", async () => {
    const { createIdentitySdk } = await import("./identity.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdentitySdk(client);
    await sdk.unlinkLinkedAccount("link-1");
    expect(calls[0]).toEqual(["DELETE", "/identity/linked-accounts/link-1", undefined]);
  });

  it("listExternalIds: GET /identity/external-ids", async () => {
    const { createIdentitySdk } = await import("./identity.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdentitySdk(client);
    await sdk.listExternalIds();
    expect(calls[0]).toEqual(["GET", "/identity/external-ids", undefined]);
  });

  it("linkExternalId: POST /identity/external-ids", async () => {
    const { createIdentitySdk } = await import("./identity.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdentitySdk(client);
    await sdk.linkExternalId({ provider: "github", externalId: "gh-123" });
    expect(calls[0]).toEqual(["POST", "/identity/external-ids", { provider: "github", externalId: "gh-123" }]);
  });

  it("unlinkExternalId: DELETE /identity/external-ids/:id", async () => {
    const { createIdentitySdk } = await import("./identity.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdentitySdk(client);
    await sdk.unlinkExternalId("ext-1");
    expect(calls[0]).toEqual(["DELETE", "/identity/external-ids/ext-1", undefined]);
  });
});

// ── webhooks.sdk.ts — added methods ─────────────────────────────────────────

describe("webhooks.sdk — added methods", () => {
  it("listEvents: GET /webhooks/events", async () => {
    const { createWebhookSdk } = await import("./webhooks.sdk");
    const { calls, client } = mockClient();
    const sdk = createWebhookSdk(client);
    await sdk.listEvents();
    expect(calls[0]).toEqual(["GET", "/webhooks/events", undefined]);
  });

  it("listEvents: includes query params", async () => {
    const { createWebhookSdk } = await import("./webhooks.sdk");
    const { calls, client } = mockClient();
    const sdk = createWebhookSdk(client);
    await sdk.listEvents({ status: "failed", limit: 10 });
    expect(calls[0]?.[1]).toContain("status=failed");
    expect(calls[0]?.[1]).toContain("limit=10");
  });

  it("retryEvent: POST /webhooks/events/:id/retry", async () => {
    const { createWebhookSdk } = await import("./webhooks.sdk");
    const { calls, client } = mockClient();
    const sdk = createWebhookSdk(client);
    await sdk.retryEvent("evt-1");
    expect(calls[0]).toEqual(["POST", "/webhooks/events/evt-1/retry", undefined]);
  });
});

// ── idp.sdk.ts ──────────────────────────────────────────────────────────────

describe("idp.sdk", () => {
  it("listConnections: GET /idp/connections", async () => {
    const { createIdpSdk } = await import("./idp.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdpSdk(client);
    await sdk.listConnections();
    expect(calls[0]).toEqual(["GET", "/idp/connections", undefined]);
  });

  it("getConnection: GET /idp/connections/:id", async () => {
    const { createIdpSdk } = await import("./idp.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdpSdk(client);
    await sdk.getConnection("conn-1");
    expect(calls[0]).toEqual(["GET", "/idp/connections/conn-1", undefined]);
  });

  it("createConnection: POST /idp/connections", async () => {
    const { createIdpSdk } = await import("./idp.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdpSdk(client);
    await sdk.createConnection({ protocol: "OIDC", providerName: "Google" });
    expect(calls[0]).toEqual(["POST", "/idp/connections", { protocol: "OIDC", providerName: "Google" }]);
  });

  it("updateConnection: PATCH /idp/connections/:id", async () => {
    const { createIdpSdk } = await import("./idp.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdpSdk(client);
    await sdk.updateConnection("conn-1", { enabled: false });
    expect(calls[0]).toEqual(["PATCH", "/idp/connections/conn-1", { enabled: false }]);
  });

  it("deleteConnection: DELETE /idp/connections/:id", async () => {
    const { createIdpSdk } = await import("./idp.sdk");
    const { calls, client } = mockClient();
    const sdk = createIdpSdk(client);
    await sdk.deleteConnection("conn-1");
    expect(calls[0]).toEqual(["DELETE", "/idp/connections/conn-1", undefined]);
  });
});
