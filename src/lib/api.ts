/**
 * ArcID typed API client
 * All methods read NEXT_PUBLIC_API_URL from env.
 * The token is read from localStorage ("arcid_token").
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("arcid_token");
}

export function setToken(token: string) {
  localStorage.setItem("arcid_token", token);
}

export function clearToken() {
  localStorage.removeItem("arcid_token");
  localStorage.removeItem("arcid_refresh_token");
}

export function setRefreshToken(token: string) {
  localStorage.setItem("arcid_refresh_token", token);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("arcid_refresh_token");
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: { auth?: boolean; rawBody?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getToken();
  if (options?.auth !== false && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const e = new Error(err.message ?? "Request failed") as any;
    e.status = res.status;
    e.code = err.error;
    e.data = err;
    throw e;
  }

  return res.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>("GET", path, undefined, { auth: true });
const post = <T>(path: string, body?: unknown, auth = true) => request<T>("POST", path, body, { auth });
const del = <T>(path: string) => request<T>("DELETE", path, undefined, { auth: true });
const patch = <T>(path: string, body?: unknown) => request<T>("PATCH", path, body, { auth: true });

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  register: (body: { email: string; password: string; name?: string }) =>
    post<{ success: boolean; data: { identity: any } }>("/auth/register", body, false),

  login: (body: { email: string; password: string }) =>
    post<{ success: boolean; data: any }>("/auth/login", body, false),

  logout: (sessionId: string) =>
    post<{ success: boolean }>("/auth/logout", { sessionId }),

  verifyEmail: (token: string) =>
    post<{ success: boolean }>("/auth/verify-email", { token }, false),

  requestPasswordReset: (email: string) =>
    post<{ success: boolean }>("/auth/password/reset", { email }, false),

  confirmPasswordReset: (token: string, newPassword: string) =>
    post<{ success: boolean }>("/auth/password/reset/confirm", { token, newPassword }, false),

  requestMagicLink: (email: string) =>
    post<{ success: boolean }>("/auth/magic-link/request", { email }, false),

  redeemMagicLink: (token: string) =>
    post<{ success: boolean; data: any }>("/auth/magic-link", { token }, false),

  verifyMfa: (code: string, sessionId: string) =>
    post<{ success: boolean; data: any }>("/auth/mfa/verify", { code, sessionId }, false),

  setupMfa: () =>
    post<{ success: boolean; data: { secret: string; uri: string; qrCode: string } }>("/auth/mfa/setup", { type: "TOTP" }),

  confirmMfa: (code: string) =>
    post<{ success: boolean; data: { recoveryCodes: string[] } }>("/auth/mfa/confirm", { code }),

  disableMfa: () => del<{ success: boolean }>("/auth/mfa"),

  getSessions: () => get<{ success: boolean; data: any[] }>("/auth/sessions"),

  switchContext: (tenantId: string) =>
    post<{ success: boolean; data: any }>("/auth/switch-context", { tenantId }),
};

// ── Identity / Profile ─────────────────────────────────────────────────────

export const identity = {
  getProfile: () => get<{ success: boolean; data: any }>("/identity/profile"),
  updateProfile: (body: { name?: string; picture?: string }) =>
    patch<{ success: boolean; data: any }>("/identity/profile", body),
  deleteAccount: () => del<{ success: boolean }>("/identity/profile"),
  getDevices: () => get<{ success: boolean; data: any[] }>("/identity/devices"),
  revokeDevice: (deviceId: string) => del<{ success: boolean }>(`/identity/devices/${deviceId}`),
  listPasskeys: () => get<{ success: boolean; data: any[] }>("/identity/passkeys").catch(() => ({ success: true, data: [] })),
};

// ── OAuth / Clients ────────────────────────────────────────────────────────

export const oauth = {
  listClients: () => get<{ success: boolean; data: any[] }>("/oauth/clients").catch(() => ({ success: true, data: [] })),
  createClient: (body: any) =>
    post<{ success: boolean; data: any }>("/oauth/clients", body),
  getConsents: () => get<{ success: boolean; data: any[] }>("/oauth/consent").catch(() => ({ success: true, data: [] })),
  revokeConsent: (clientId: string) =>
    post<{ success: boolean }>("/oauth/consent/revoke", { clientId }),
  introspect: (token: string, clientId: string) =>
    post<any>("/oauth/introspect", { token, client_id: clientId }, false),
};

// ── Credentials ────────────────────────────────────────────────────────────

export const credentials = {
  issue: (body: { subjectDid: string; credentialSubject: Record<string, any>; type?: string[]; expiresAt?: string }) =>
    post<{ success: boolean; data: any }>("/credentials/issue", body),
  verify: (body: { credential: string; format?: string }) =>
    post<{ success: boolean; data: any }>("/credentials/verify", body, false),
  revoke: (credentialId: string) =>
    post<{ success: boolean }>("/credentials/revoke", { credentialId }),
  getStatusList: (listId: string) => get<any>(`/credentials/status-lists/${listId}`),
  getDid: (tenantId?: string) => get<any>(tenantId ? `/credentials/did/${tenantId}` : "/credentials/did"),
};

// ── Billing / Subscription ─────────────────────────────────────────────────

export const billing = {
  getSubscription: () => get<{ success: boolean; data: any }>("/subscription"),
  upgradePlan: (plan: "FREE" | "PRO" | "ENTERPRISE") =>
    post<{ success: boolean; data: any }>("/subscription/upgrade", { plan }),
  setPlan: (body: { tenantId?: string; plan: "FREE" | "PRO" | "ENTERPRISE" }) =>
    post<{ success: boolean; data: any }>("/subscription/plan", body),
};

// ── Tenant ─────────────────────────────────────────────────────────────────

export const tenant = {
  list: () => get<{ success: boolean; data: any[] }>("/tenant").catch(() => ({ success: true, data: [] })),
  create: (body: { name: string; slug: string; sector?: string }) =>
    post<{ success: boolean; data: any }>("/tenant", body),
  getMembers: (tenantId: string) => get<{ success: boolean; data: any[] }>(`/tenant/${tenantId}/members`),
  addMember: (tenantId: string, body: { identityId: string; role: string }) =>
    post<{ success: boolean; data: any }>(`/tenant/${tenantId}/members`, body),
  removeMember: (tenantId: string, memberId: string) =>
    del<{ success: boolean }>(`/tenant/${tenantId}/members/${memberId}`),
  getPolicy: (tenantId: string) => get<any>(`/tenant/${tenantId}/policy`),
  updatePolicy: (tenantId: string, body: any) =>
    patch<any>(`/tenant/${tenantId}/policy`, body),
};

// ── Audit ──────────────────────────────────────────────────────────────────

export const audit = {
  getLogs: (params?: { limit?: number; page?: number; action?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.page) q.set("page", String(params.page));
    if (params?.action) q.set("action", params.action);
    return get<{ success: boolean; data: any[]; total?: number }>(`/audit?${q.toString()}`);
  },
};

// ── Admin ──────────────────────────────────────────────────────────────────

export const admin = {
  listIdentities: (params?: { limit?: number; page?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.page) q.set("page", String(params.page));
    return get<{ success: boolean; data: any[] }>(`/identity/admin?${q.toString()}`);
  },
  suspendIdentity: (id: string) =>
    post<{ success: boolean }>(`/identity/admin/${id}/suspend`, {}),
};
