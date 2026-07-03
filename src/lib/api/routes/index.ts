// src/lib/api/routes/index.ts
// Central route constants consumed by frontend API clients.
// All paths are relative to the /api/v1 base (set in the API client).

export const ROUTES = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    logout: "/auth/logout",
    emailVerify: "/auth/email/verify",
    magicLinkRequest: "/auth/magic-link/request",
    magicLink: "/auth/magic-link",
    sessions: "/auth/sessions",
    session: (id: string) => `/auth/sessions/${id}`,
    stepUp: "/auth/step-up",
    mfaVerify: "/auth/mfa/verify",
    mfaRecovery: "/auth/mfa/recovery",
    mfaSetup: "/auth/mfa/setup",
    mfaConfirm: "/auth/mfa/confirm",
    mfaDisable: "/auth/mfa/disable",
    passkeyOptionsRegister: "/auth/passkey/options/register",
    passkeyRegister: "/auth/passkey/register",
    passkeyOptionsAuthenticate: "/auth/passkey/options/authenticate",
    passkeyAuthenticate: "/auth/passkey/authenticate",
    passkeys: "/auth/passkey",
    passkey: (id: string) => `/auth/passkey/${id}`,
    switchContext: "/auth/switch-context",
    passwordReset: "/auth/password/reset",
    passwordResetConfirm: "/auth/password/reset/confirm",
    passwordChange: "/auth/password/change",
  },
  identity: {
    profile: "/identity/profile",
    devices: "/identity/devices",
    device: (id: string) => `/identity/devices/${id}`,
    linkedAccounts: "/identity/linked-accounts",
    linkedAccount: (id: string) => `/identity/linked-accounts/${id}`,
    delegations: "/identity/delegations",
    admin: "/identity/admin",
    adminSuspend: (id: string) => `/identity/admin/${id}/suspend`,
    adminStatus: (id: string) => `/identity/${id}/status`,
  },
  audit: {
    logs: "/audit/logs",
  },
  tenants: {
    list: "/tenants",
    create: "/tenants",
    bySlug: (slug: string) => `/tenants/${slug}`,
    members: (id: string) => `/tenants/${id}/members`,
    member: (id: string, mid: string) => `/tenants/${id}/members/${mid}`,
    policy: (id: string) => `/tenants/${id}/policy`,
    signingKeys: (id: string) => `/tenants/${id}/signing-keys`,
    signingKey: (id: string, kid: string) =>
      `/tenants/${id}/signing-keys/${kid}`,
    did: (id: string) => `/tenants/${id}/did`,
    inviteAccept: "/invites/accept",
  },
  billing: {
    subscription: "/subscription",
    upgrade: "/subscription/upgrade",
  },
  oauth: {
    authorize: "/oauth/authorize",
    token: "/oauth/token",
    revoke: "/oauth/revoke",
    introspect: "/oauth/introspect",
    userinfo: "/oauth/userinfo",
    jwks: "/oauth/jwks",
    consent: "/oauth/consent",
    consents: "/oauth/consents",
    clients: "/oauth/clients",
    client: (id: string) => `/oauth/clients/${id}`,
  },
  credentials: {
    issue: "/credentials/issue",
    verify: "/credentials/verify",
    revoke: "/credentials/revoke",
    status: (id: string) => `/credentials/status-lists/${id}`,
  },
  // Webhook endpoint management (PRO plan required)
  webhooks: {
    endpoints: "/webhooks/endpoints",
    endpoint: (id: string) => `/webhooks/endpoints/${id}`,
    endpointTest: (id: string) => `/webhooks/endpoints/${id}/test`,
  },
} as const;

// Keep legacy named exports for backward compatibility
export const authRoutes = { base: ROUTES.auth.login };
export const auditRoutes = { base: ROUTES.audit.logs };
export const billingRoutes = { base: ROUTES.billing.subscription };
export const credentialsRoutes = { base: ROUTES.credentials.verify };
export const identityRoutes = { base: ROUTES.identity.profile };
export const oauthRoutes = { base: ROUTES.oauth.userinfo };
export const tenantRoutes = { base: ROUTES.tenants.list };

export const routes = {
  auth: authRoutes,
  audit: auditRoutes,
  billing: billingRoutes,
  credentials: credentialsRoutes,
  identity: identityRoutes,
  oauth: oauthRoutes,
  tenant: tenantRoutes,
} as const;
