import type { SdkClient } from "./client";

export interface AuditListParams {
  identityId?: string;
  tenantId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function createAuditSdk(client: SdkClient) {
  return {
    list: (params?: AuditListParams) => {
      const query = new URLSearchParams();
      if (params?.identityId) query.set("identityId", params.identityId);
      if (params?.tenantId) query.set("tenantId", params.tenantId);
      if (params?.action) query.set("action", params.action);
      if (params?.from) query.set("from", params.from);
      if (params?.to) query.set("to", params.to);
      if (params?.page) query.set("page", String(params.page));
      if (params?.limit) query.set("limit", String(params.limit));
      const qs = query.toString();
      return client.get<any[]>(`/audit/logs${qs ? `?${qs}` : ""}`);
    },
  };
}
