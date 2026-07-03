// src/sdk/client.ts
// Base HTTP client. Never import this in pages or components.
// Pages → hooks → stores → sdk.

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class SdkError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "SdkError";
  }
}

export type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

async function request<T>(
  path: string,
  options: RequestOptions = {},
  getToken?: () => string | null,
): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json" });

  const token =
    getToken?.() ??
    (typeof window !== "undefined"
      ? localStorage.getItem("arcid:access_token")
      : null);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const tenantId =
    typeof window !== "undefined"
      ? localStorage.getItem("arcid:tenant_id")
      : null;
  if (tenantId) headers.set("X-ArcID-Tenant-Id", tenantId);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return {} as T;

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new SdkError(
      res.status,
      json.message ?? "Request failed",
      json.error,
      json,
    );
  }

  return (json.data ?? json) as T;
}

// Token key constants — single source of truth across the entire app
export const TOKEN_KEYS = {
  access: "arcid:access_token",
  refresh: "arcid:refresh_token",
  user: "arcid:user",
  tenant: "arcid:tenant_id",
  session: "arcid:session_id", // ← NEW: stores the sessionId for logout
  mfaState: "arcid:mfa_session",
} as const;

export const sdk = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
