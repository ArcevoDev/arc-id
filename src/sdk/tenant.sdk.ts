// src/sdk/tenant.sdk.ts
import { sdk } from "./client";

export const tenantSdk = {
  list: () => sdk.get<any[]>("/api/v1/tenants"),
  create: (data: { name: string; slug: string; sector?: string }) =>
    sdk.post<any>("/api/v1/tenants", data),
  get: (id: string) => sdk.get<any>(`/api/v1/tenants/${id}`),
  listMembers: (id: string) => sdk.get<any[]>(`/api/v1/tenants/${id}/members`),
  addMember: (id: string, data: { email: string; role?: string }) =>
    sdk.post<any>(`/api/v1/tenants/${id}/invites`, data),
  removeMember: (tenantId: string, memberId: string) =>
    sdk.delete<void>(`/api/v1/tenants/${tenantId}/members/${memberId}`),
  getPolicy: (id: string) => sdk.get<any>(`/api/v1/tenants/${id}/policy`),
  updatePolicy: (id: string, data: any) =>
    sdk.patch<any>(`/api/v1/tenants/${id}/policy`, data),
  switchContext: (tenantId: string) =>
    sdk.post<any>("/api/v1/auth/context/switch", { tenantId }),
};
