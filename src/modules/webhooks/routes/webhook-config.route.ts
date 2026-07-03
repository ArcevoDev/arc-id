import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomBytes, createHmac } from "crypto";
import { ApiError } from "@/core/errors";
import { assertSafeUrl } from "@/lib/url-safety";
import { TenantService } from "@/modules/tenant/services/tenant.service";
import { auditService } from "@/modules/audit/services/audit.service";
import {
  EndpointBodySchema,
  EndpointPatchSchema,
  EndpointParamsSchema,
  type EndpointBody,
  type EndpointPatch,
  type EndpointParams,
  EventListQuerySchema,
  EventParamsSchema,
  type EventListQuery,
  type EventParams,
} from "../validators/webhook.schema";

export async function webhookConfigRoute(fastify: FastifyInstance) {
  // ── POST /webhooks/endpoints ──────────────────────────────────────────────
  fastify.post(
    "/endpoints",
    {
      preHandler: fastify.auth.requirePlan("PRO"),
      schema: {
        tags: ["Webhook Delivery Engine"],
        summary:
          "Register a new outbound webhook endpoint for your tenant (PRO)",
        description:
          "Registers a URL to receive webhook events. A signing secret is returned, store it securely and use it to verify the X-ArcID-Signature header on incoming requests.",
        security: [{ bearerAuth: [] }],
        body: EndpointBodySchema,
        response: {
          201: z.object({
            success: z.boolean(),
            data: z.object({
              id: z.string(),
              url: z.string(),
              secret: z
                .string()
                .describe(
                  "HMAC signing secret — only returned at creation. Store it securely.",
                ),
              eventTypes: z.array(z.string()),
              enabled: z.boolean(),
              createdAt: z.string(),
            }),
          }),
        },
      },
    },
    async (req, reply) => {
      const body = req.body as EndpointBody;
      const tenantId = req.identity.tenantId;

      if (!tenantId) {
        throw ApiError.badRequest(
          "Webhook endpoints must be scoped to a tenant. Switch to a tenant context first via POST /auth/context/switch.",
        );
      }

      // SSRF defence — rejects private IPs, cloud metadata, non-HTTP(S) schemes.
      assertSafeUrl(body.url);

      // Ensure the caller is an ADMIN of this tenant
      const tenantService = new TenantService(fastify.db);
      await tenantService.assertMembership(tenantId, req.identity.id, "ADMIN");

      // Cap endpoints per tenant to prevent abuse
      const count = await fastify.db.webhookEndpoint.count({
        where: { tenantId, enabled: true },
      });
      if (count >= 10) {
        throw ApiError.badRequest(
          "Maximum of 10 active webhook endpoints per tenant. Disable or delete an existing endpoint before adding a new one.",
        );
      }

      // Generate a 32-byte hex signing secret if the caller didn't supply one.
      const secret = body.secret ?? randomBytes(32).toString("hex");

      const endpoint = await fastify.db.webhookEndpoint.create({
        data: {
          tenantId,
          url: body.url,
          secret,
          eventTypes: body.eventTypes,
          enabled: body.enabled,
          createdBy: req.identity.id,
        },
      });

      void auditService
        .log({
          action: "WEBHOOK_DELIVERED",
          identityId: req.identity.id,
          tenantId,
          ip: req.ip,
          metadata: {
            endpointId: endpoint.id,
            url: body.url,
            action: "CREATED",
          },
        })
        .catch(() => {});

      return reply.status(201).send({
        success: true,
        data: {
          id: endpoint.id,
          url: endpoint.url,
          secret,
          eventTypes: endpoint.eventTypes,
          enabled: endpoint.enabled,
          createdAt: endpoint.createdAt.toISOString(),
        },
      });
    },
  );

  // ── GET /webhooks/endpoints ───────────────────────────────────────────────
  fastify.get(
    "/endpoints",
    {
      preHandler: fastify.auth.requirePlan("PRO"),
      schema: {
        tags: ["Webhook Delivery Engine"],
        summary: "List all webhook endpoints registered for your tenant (PRO)",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ success: z.boolean(), data: z.array(z.any()) }),
        },
      },
    },
    async (req, reply) => {
      const tenantId = req.identity.tenantId;
      if (!tenantId) throw ApiError.badRequest("No active tenant context");

      const endpoints = await fastify.db.webhookEndpoint.findMany({
        where: { tenantId },
        select: {
          id: true,
          url: true,
          eventTypes: true,
          enabled: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ success: true, data: endpoints });
    },
  );

  // ── PATCH /webhooks/endpoints/:id ─────────────────────────────────────────
  fastify.patch(
    "/endpoints/:id",
    {
      preHandler: fastify.auth.requirePlan("PRO"),
      schema: {
        tags: ["Webhook Delivery Engine"],
        summary:
          "Update a webhook endpoint — enable/disable, change URL or event filter (PRO)",
        security: [{ bearerAuth: [] }],
        params: EndpointParamsSchema,
        body: EndpointPatchSchema,
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as EndpointParams;
      const body = req.body as EndpointPatch;
      const tenantId = req.identity.tenantId;
      if (!tenantId) throw ApiError.badRequest("No active tenant context");

      const endpoint = await fastify.db.webhookEndpoint.findFirst({
        where: { id, tenantId },
      });
      if (!endpoint) throw ApiError.notFound("Webhook endpoint not found");

      // SSRF check on new URL if provided
      if (body.url) assertSafeUrl(body.url);

      const updated = await fastify.db.webhookEndpoint.update({
        where: { id },
        data: {
          url: body.url,
          eventTypes: body.eventTypes,
          enabled: body.enabled,
        },
        select: {
          id: true,
          url: true,
          eventTypes: true,
          enabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.send({ success: true, data: updated });
    },
  );

  // ── DELETE /webhooks/endpoints/:id ────────────────────────────────────────
  fastify.delete(
    "/endpoints/:id",
    {
      preHandler: fastify.auth.requirePlan("PRO"),
      schema: {
        tags: ["Webhook Delivery Engine"],
        summary: "Remove a webhook endpoint (PRO)",
        security: [{ bearerAuth: [] }],
        params: EndpointParamsSchema,
        response: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as EndpointParams;
      const tenantId = req.identity.tenantId;
      if (!tenantId) throw ApiError.badRequest("No active tenant context");

      const endpoint = await fastify.db.webhookEndpoint.findFirst({
        where: { id, tenantId },
      });
      if (!endpoint) throw ApiError.notFound("Webhook endpoint not found");

      await fastify.db.webhookEndpoint.delete({ where: { id } });

      return reply.send({ success: true });
    },
  );

  // ── POST /webhooks/endpoints/:id/test ─────────────────────────────────────
  fastify.post(
    "/endpoints/:id/test",
    {
      preHandler: fastify.auth.requirePlan("PRO"),
      schema: {
        tags: ["Webhook Delivery Engine"],
        summary: "Send a test ping to a webhook endpoint (PRO)",
        security: [{ bearerAuth: [] }],
        params: EndpointParamsSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            delivered: z.boolean(),
            statusCode: z.number().optional(),
            error: z.string().optional(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as EndpointParams;
      const tenantId = req.identity.tenantId;
      if (!tenantId) throw ApiError.badRequest("No active tenant context");

      const endpoint = await fastify.db.webhookEndpoint.findFirst({
        where: { id, tenantId },
      });
      if (!endpoint) throw ApiError.notFound("Webhook endpoint not found");
      if (!endpoint.enabled) {
        throw ApiError.badRequest(
          "Endpoint is disabled. Enable it before sending a test ping.",
        );
      }

      // Build a synthetic test payload
      const timestamp = Date.now();
      const body = JSON.stringify({
        eventType: "WEBHOOK_TEST",
        tenantId,
        payload: { message: "ArcID webhook test ping", timestamp },
        createdAt: new Date().toISOString(),
      });

      // Sign using the endpoint's own secret (same HMAC pattern as the worker)
      const signature = createHmac("sha256", endpoint.secret)
        .update(`${timestamp}.${body}`)
        .digest("hex");

      try {
        assertSafeUrl(endpoint.url);
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-ArcID-Signature": `sha256=${signature}`,
            "X-ArcID-Timestamp": String(timestamp),
            "X-ArcID-Event-Type": "WEBHOOK_TEST",
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });

        return reply.send({
          success: true,
          delivered: res.ok,
          statusCode: res.status,
        });
      } catch (err: any) {
        return reply.send({
          success: true,
          delivered: false,
          error: err?.message ?? "Delivery failed",
        });
      }
    },
  );

  // ── GET /webhooks/events ──────────────────────────────────────────────────
  fastify.get(
    "/events",
    {
      preHandler: fastify.auth.requirePlan("PRO"),
      schema: {
        tags: ["Webhook Delivery Engine"],
        summary:
          "List webhook delivery events for your tenant, optionally filtered by status (PRO)",
        description:
          "status=failed returns events that exhausted all retry attempts " +
          "(deliveredAt is null and nextRetryAt is null). status=pending " +
          "returns events still awaiting delivery or retry. Omit status for all.",
        security: [{ bearerAuth: [] }],
        querystring: EventListQuerySchema,
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(z.any()),
            nextCursor: z.string().nullable(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { status, limit, cursor } = req.query as EventListQuery;
      const tenantId = req.identity.tenantId;

      if (!tenantId) {
        throw ApiError.badRequest(
          "Webhook events must be scoped to a tenant. " +
            "Switch to a tenant context first via POST /auth/context/switch.",
        );
      }

      const tenantService = new TenantService(fastify.db);
      await tenantService.assertMembership(tenantId, req.identity.id, "ADMIN");

      const statusFilter =
        status === "failed"
          ? { deliveredAt: null, nextRetryAt: null }
          : status === "pending"
            ? { deliveredAt: null, nextRetryAt: { not: null } }
            : status === "delivered"
              ? { deliveredAt: { not: null } }
              : {};

      const events = await fastify.db.webhookEvent.findMany({
        where: {
          tenantId,
          ...statusFilter,
          ...(cursor ? { id: { lt: cursor } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          eventType: true,
          targetUrl: true,
          attempts: true,
          maxAttempts: true,
          deliveredAt: true,
          lastError: true,
          createdAt: true,
          nextRetryAt: true,
        },
      });

      return reply.send({
        success: true,
        data: events,
        nextCursor:
          events.length === limit ? events[events.length - 1].id : null,
      });
    },
  );

  // ── POST /webhooks/events/:id/retry ───────────────────────────────────────
  fastify.post(
    "/events/:id/retry",
    {
      preHandler: fastify.auth.requirePlan("PRO"),
      schema: {
        tags: ["Webhook Delivery Engine"],
        summary: "Manually re-queue a failed webhook event for delivery (PRO)",
        description:
          "Resets attempts to 0 and nextRetryAt to now, so the worker " +
          "picks it up on its next poll. Only valid for events that have " +
          "exhausted retries (deliveredAt and nextRetryAt both null) — " +
          "an event still actively retrying, or already delivered, can't " +
          "be manually retried.",
        security: [{ bearerAuth: [] }],
        params: EventParamsSchema,
        response: {
          200: z.object({ success: z.boolean(), data: z.any() }),
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as EventParams;
      const tenantId = req.identity.tenantId;

      if (!tenantId) {
        throw ApiError.badRequest(
          "Webhook events must be scoped to a tenant. " +
            "Switch to a tenant context first via POST /auth/context/switch.",
        );
      }

      const tenantService = new TenantService(fastify.db);
      await tenantService.assertMembership(tenantId, req.identity.id, "ADMIN");

      const event = await fastify.db.webhookEvent.findFirst({
        where: { id, tenantId },
      });

      if (!event) {
        throw ApiError.notFound("Webhook event not found");
      }

      if (event.deliveredAt !== null) {
        throw ApiError.badRequest(
          "This event was already delivered — nothing to retry",
        );
      }

      if (event.nextRetryAt !== null) {
        throw ApiError.badRequest(
          "This event is still actively retrying — manual retry is only " +
            "for events that have exhausted all attempts",
        );
      }

      const updated = await fastify.db.webhookEvent.update({
        where: { id },
        data: {
          attempts: 0,
          nextRetryAt: new Date(),
          lastError: null,
        },
      });

      void auditService
        .log({
          action: "WEBHOOK_DELIVERED",
          identityId: req.identity.id,
          tenantId,
          ip: req.ip,
          metadata: {
            eventId: id,
            action: "MANUAL_RETRY_QUEUED",
          },
        })
        .catch(() => {});

      return reply.send({ success: true, data: updated });
    },
  );
}
