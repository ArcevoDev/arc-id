// src/modules/billing/routes/subscription.route.ts
// COMPLETE REWRITE: The Subscription model is TENANT-scoped (tenantId @unique).
// The previous version used identityId which doesn't exist on Subscription → all billing
// routes were crashing. Provider webhook data goes in ExternalBillingIntegration.
import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { upgradePlanFlow } from "../flows/upgrade-plan.flow";
import { SubscriptionService } from "../services/subscription.service";
import { config } from "@/core/config";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

// ── Plan code mappings per provider ──────────────────────────────────────────
const PAYSTACK_PLAN_MAP: Record<string, "FREE" | "PRO" | "ENTERPRISE"> = {
  PLN_arcid_pro: "PRO",
  PLN_arcid_enterprise: "ENTERPRISE",
};

const STRIPE_PLAN_MAP: Record<string, "FREE" | "PRO" | "ENTERPRISE"> = {
  price_arcid_pro: "PRO",
  price_arcid_enterprise: "ENTERPRISE",
};

// ── Webhook signature verification ───────────────────────────────────────────
function verifyPaystackWebhook(payload: string, signature: string): boolean {
  if (!config.billing.paystack.webhookSecret) return false;
  const expected = createHmac("sha512", config.billing.paystack.webhookSecret)
    .update(payload).digest("hex");
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

function verifyStripeWebhook(payload: string, signature: string): boolean {
  if (!config.billing.stripe.webhookSecret) return false;
  const expected = createHmac("sha256", config.billing.stripe.webhookSecret)
    .update(payload).digest("hex");
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function subscriptionRoute(fastify: FastifyInstance) {

  // GET /subscription — returns the calling user's active tenant subscription
  fastify.get(
    "/subscription",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Billing & Subscriptions"],
        summary: "Get the current subscription plan for the authenticated user's tenant",
        security: [{ bearerAuth: [] }],
        response: { 200: z.object({ success: z.boolean(), data: z.any().nullable() }) },
      },
    },
    async (req, reply) => {
      const tenantId = req.identity.tenantId ?? "SYSTEM";
      const subService = new SubscriptionService(fastify.db);
      const sub = await subService.getForTenant(tenantId);
      return reply.send({ success: true, data: sub ?? { tenantId, plan: "FREE", status: "ACTIVE" } });
    },
  );

  // POST /subscription/upgrade — upgrade the calling user's tenant plan
  fastify.post(
    "/subscription/upgrade",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Billing & Subscriptions"],
        summary: "Upgrade the tenant subscription plan (ADMIN only for org tenants)",
        security: [{ bearerAuth: [] }],
        body: z.object({ plan: z.enum(["FREE", "PRO", "ENTERPRISE"]) }),
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(upgradePlanFlow, req.body, {
        userId: req.identity.id,
        tenantId: req.identity.tenantId,
      });
      return reply.send({ success: true, data: result });
    },
  );

  // POST /webhooks/billing/paystack
  // IMPORTANT: pass tenantId in Paystack payment metadata:
  //   { metadata: { tenantId: "cuid-of-the-tenant" } }
  fastify.post(
    "/webhooks/billing/paystack",
    { config: { rawBody: true } },
    async (req, reply) => {
      const rawBody = (req as any).rawBody as string;
      const sig = req.headers["x-paystack-signature"] as string;
      if (!verifyPaystackWebhook(rawBody, sig)) {
        return reply.status(401).send({ error: "Invalid signature" });
      }

      const event = JSON.parse(rawBody) as any;
      fastify.log.info({ event: event.event }, "[BILLING][PAYSTACK]");

      const { event: eventName, data } = event;
      const tenantId: string | undefined =
        data?.metadata?.tenantId ?? data?.customer?.metadata?.tenantId;

      if (!tenantId) {
        fastify.log.warn("[BILLING][PAYSTACK] No tenantId in metadata — ignoring event");
        return reply.status(200).send({ received: true });
      }

      const subService = new SubscriptionService(fastify.db);

      if (eventName === "subscription.create" || eventName === "charge.success") {
        const planCode = data?.plan?.plan_code ?? data?.plan_code;
        const plan = PAYSTACK_PLAN_MAP[planCode];
        if (plan) {
          await subService.activateFromProvider(
            tenantId, plan, "PAYSTACK",
            data?.customer?.customer_code,
            data?.subscription_code ?? data?.reference,
          );
          fastify.log.info({ tenantId, plan }, "[BILLING][PAYSTACK] Plan activated");
        }
      }

      if (eventName === "subscription.not_renew" || eventName === "subscription.disable") {
        await subService.cancelFromProvider(tenantId);
        fastify.log.info({ tenantId }, "[BILLING][PAYSTACK] Subscription cancelled → FREE");
      }

      return reply.status(200).send({ received: true });
    },
  );

  // POST /webhooks/billing/stripe
  // IMPORTANT: pass tenantId in Stripe customer metadata when creating the checkout session:
  //   customer_update.metadata = { tenantId: "cuid" }
  fastify.post(
    "/webhooks/billing/stripe",
    { config: { rawBody: true } },
    async (req, reply) => {
      const rawBody = (req as any).rawBody as string;
      const sig = req.headers["stripe-signature"] as string;
      if (!verifyStripeWebhook(rawBody, sig)) {
        return reply.status(401).send({ error: "Invalid signature" });
      }

      const event = JSON.parse(rawBody) as any;
      fastify.log.info({ type: event.type }, "[BILLING][STRIPE]");

      const subService = new SubscriptionService(fastify.db);
      const obj = event.data?.object;
      const tenantId: string | undefined = obj?.metadata?.tenantId;

      if (!tenantId) {
        fastify.log.warn("[BILLING][STRIPE] No tenantId in metadata — ignoring event");
        return reply.status(200).send({ received: true });
      }

      if (event.type === "customer.subscription.created" || event.type === "invoice.payment_succeeded") {
        const priceId =
          obj?.items?.data?.[0]?.price?.id ??
          obj?.lines?.data?.[0]?.price?.id;
        const plan = STRIPE_PLAN_MAP[priceId];
        if (plan) {
          await subService.activateFromProvider(
            tenantId, plan, "STRIPE",
            obj?.customer,
            obj?.subscription ?? obj?.id,
          );
          fastify.log.info({ tenantId, plan }, "[BILLING][STRIPE] Plan activated");
        }
      }

      if (event.type === "customer.subscription.deleted") {
        await subService.cancelFromProvider(tenantId);
        fastify.log.info({ tenantId }, "[BILLING][STRIPE] Subscription cancelled → FREE");
      }

      return reply.status(200).send({ received: true });
    },
  );
}