// src/sdk/webhooks.sdk.ts
import { sdk } from "./client";

export const webhooksSdk = {
  list: () => sdk.get<any[]>("/api/v1/webhooks/endpoints"),
  create: (data: any) => sdk.post<any>("/api/v1/webhooks/endpoints", data),
  update: (id: string, data: any) =>
    sdk.patch<any>(`/api/v1/webhooks/endpoints/${id}`, data),
  delete: (id: string) => sdk.delete<void>(`/api/v1/webhooks/endpoints/${id}`),
  test: (id: string) => sdk.post<any>(`/api/v1/webhooks/endpoints/${id}/test`),
};
