// src/sdk/identity.sdk.ts
import { sdk } from "./client";

export const identitySdk = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    return sdk.get<any>(`/api/v1/identity/admin?${q}`);
  },
  updateProfile: (data: { name?: string; picture?: string }) =>
    sdk.patch<any>("/api/v1/identity/profile", data),
  deleteAccount: () => sdk.delete<void>("/api/v1/identity/me"),
  suspend: (id: string, reason?: string) =>
    sdk.post<void>(`/api/v1/identity/admin/${id}/suspend`, { reason }),
  setStatus: (id: string, status: string, reason?: string) =>
    sdk.patch<void>(`/api/v1/identity/${id}/status`, { status, reason }),
};
