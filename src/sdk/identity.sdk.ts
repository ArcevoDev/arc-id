import type { SdkClient } from "./client";

export function createIdentitySdk(client: SdkClient) {
  return {
    list: (params?: { search?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set("search", params.search);
      if (params?.status) qs.set("status", params.status);
      const q = qs.toString();
      return client.get<any[]>(`/identity/admin${q ? `?${q}` : ""}`);
    },
    suspend: (id: string, reason?: string) =>
      client.post(`/identity/admin/${id}/suspend`, { reason }),
    reinstate: (id: string, reason?: string) =>
      client.patch(`/identity/${id}/status`, reason ? { status: "ACTIVE", reason } : { status: "ACTIVE" }),
  };
}
