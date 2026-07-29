import type { SdkClient } from "./client";

export function createWebhookSdk(client: SdkClient) {
  return {
    /**
     * GET /webhooks/endpoints — list webhook endpoints.
     */
    list: () => client.get<any[]>("/webhooks/endpoints"),

    /**
     * POST /webhooks/endpoints — create a webhook endpoint.
     */
    create: (data: { url: string; events: string[]; secret?: string; enabled?: boolean }) =>
      client.post("/webhooks/endpoints", data),

    /**
     * PATCH /webhooks/endpoints/:id — update a webhook endpoint.
     */
    update: (id: string, data: { url?: string; events?: string[]; enabled?: boolean }) =>
      client.patch(`/webhooks/endpoints/${id}`, data),

    /**
     * DELETE /webhooks/endpoints/:id — delete a webhook endpoint.
     */
    delete: (id: string) => client.delete(`/webhooks/endpoints/${id}`),

    /**
     * POST /webhooks/endpoints/:id/test — send a test ping.
     */
    test: (id: string) => client.post(`/webhooks/endpoints/${id}/test`),

    /**
     * GET /webhooks/events — list webhook delivery events.
     * Supports cursor-based pagination and status filtering.
     */
    listEvents: (params?: { status?: string; cursor?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.cursor) qs.set("cursor", params.cursor);
      if (params?.limit) qs.set("limit", String(params.limit));
      const q = qs.toString();
      return client.get<any[]>(`/webhooks/events${q ? `?${q}` : ""}`);
    },

    /**
     * POST /webhooks/events/:id/retry — manually retry a failed delivery event.
     */
    retryEvent: (id: string) => client.post(`/webhooks/events/${id}/retry`),
  };
}
