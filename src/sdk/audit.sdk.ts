// src/sdk/audit.sdk.ts
import { sdk } from "./client";

export const auditSdk = {
  list: (params?: {
    page?: number;
    limit?: number;
    action?: string;
    identityId?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.action) q.set("action", params.action);
    if (params?.identityId) q.set("identityId", params.identityId);
    return sdk.get<any>(`/api/v1/audit?${q}`);
  },
};
