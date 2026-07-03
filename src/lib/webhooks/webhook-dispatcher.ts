// src/lib/webhooks/webhook-dispatcher.ts
//
// Called by flows whenever a business event occurs that tenants may subscribe to.
// Reads all enabled WebhookEndpoint rows for the tenant and creates one
// WebhookEvent delivery row per endpoint — the worker handles the actual HTTP delivery.

import type { DbClient } from "@/lib/db-client";
import type { AuditLogAction } from "@/prisma-client";

interface DispatchInput {
  tenantId: string | null | undefined;
  identityId?: string | null;
  eventType: AuditLogAction;
  // Using generic object pattern for internal consumption interfaces
  payload: Record<string, unknown>;
}

/**
 * Fans out a business event to all enabled WebhookEndpoint rows for the tenant.
 * Creates one WebhookEvent row per endpoint — delivery is handled async by the worker.
 */
export async function dispatchWebhookEvent(
  db: DbClient,
  input: DispatchInput,
): Promise<void> {
  if (!input.tenantId) return;

  const endpoints = await db.webhookEndpoint.findMany({
    where: {
      tenantId: input.tenantId,
      enabled: true,
    },
    select: {
      id: true,
      url: true,
      secret: true, // ← added
      eventTypes: true,
    },
  });

  if (endpoints.length === 0) return;

  const eventTypeStr = input.eventType as string;

  const matching = endpoints.filter(
    (ep) => ep.eventTypes.length === 0 || ep.eventTypes.includes(eventTypeStr),
  );

  if (matching.length === 0) return;

  await db.webhookEvent.createMany({
    data: matching.map((ep) => ({
      eventType: input.eventType,
      identityId: input.identityId ?? null,
      tenantId: input.tenantId,
      payload: input.payload as any,
      targetUrl: ep.url,
      secret: ep.secret, // ← added — each event signs with its own endpoint's secret
    })),
    skipDuplicates: false,
  });
}
