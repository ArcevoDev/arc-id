import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { upgradePlanFlow } from "../flows/upgrade-plan.flow";
import { presentSubscription } from "../presenters/subscription.presenter";
import { config } from "@/core/config";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

type BillingProvider = "stripe" | "paystack" | "flutterwave";

const PAYSTACK_PLAN_MAP: Record<string, "FREE" | "PRO" | "ENTERPRISE"> = {
  PLN_arcid_pro: "PRO",
  PLN_arcid_enterprise: "ENTERPRISE",
};

const STRIPE_PLAN_MAP: Record<string, "FREE" | "PRO" | "ENTERPRISE"> = {
  price_arcid_pro: "PRO",
  price_arcid_enterprise: "ENTERPRISE",
};

function verifyPaystackWebhook(payload: string, signature: string): boolean {
  if (!config.billing.paystack.webhookSecret) return false;
  const expected = createHmac("sha512", config.billing.paystack.webhookSecret).update(payload).digest("hex");
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

function verifyStripeWebhook(payload: string, signature: string): boolean {
  if (!config.billing.stripe.webhookSecret) return false;
  const expected = createHmac("sha256", config.billing.stripe.webhookSecret).update(payload).digest("hex");
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

export async function subscriptionRoute(fastify: FastifyInstance) {
  fastify.get("/subscription", {
    preHandler: fastify.auth.requireUser,
    schema: { response: { 200: z.object({ success: z.boolean(), data: z.any().nullable() }) } },
  }, async (req, reply) => {
    const sub = await fastify.db.subscription.findFirst({ where: { identityId: req.identity.id, status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
    return reply.send({ success: true, data: sub ? presentSubscription(sub) : null });
  });

  fastify.post("/subscription/upgrade", {
    preHandler: fastify.auth.requireUser,
    schema: { body: z.object({ plan: z.enum(["FREE", "PRO", "ENTERPRISE"]) }), response: { 200: z.object({ success: z.boolean(), data: z.any() }) } },
  }, async (req, reply) => {
    const result = await flowExecutor.run(upgradePlanFlow, req.body, { userId: req.identity.id, tenantId: null });
    return reply.send({ success: true, data: result });
  });

  fastify.post("/webhooks/billing/paystack", { config: { rawBody: true } }, async (req, reply) => {
    const rawBody = (req as any).rawBody as string;
    if (!verifyPaystackWebhook(rawBody, req.headers["x-paystack-signature"] as string)) return reply.status(401).send({ error: "Invalid signature" });
    const event = JSON.parse(rawBody);
    fastify.log.info({ event: event.event }, "[BILLING][PAYSTACK] Event received");
    await handleProviderEvent(fastify, "paystack", event);
    return reply.status(200).send({ received: true });
  });

  fastify.post("/webhooks/billing/stripe", { config: { rawBody: true } }, async (req, reply) => {
    const rawBody = (req as any).rawBody as string;
    if (!verifyStripeWebhook(rawBody, req.headers["stripe-signature"] as string)) return reply.status(401).send({ error: "Invalid signature" });
    const event = JSON.parse(rawBody);
    fastify.log.info({ type: event.type }, "[BILLING][STRIPE] Event received");
    await handleProviderEvent(fastify, "stripe", event);
    return reply.status(200).send({ received: true });
  });
}

async function handleProviderEvent(fastify: FastifyInstance, provider: BillingProvider, event: any) {
  try {
    if (provider === "paystack") {
      const { event: eventName, data } = event;
      if (eventName === "subscription.create" || eventName === "charge.success") {
        const identityId = data?.metadata?.identityId ?? data?.customer?.metadata?.identityId;
        const plan = PAYSTACK_PLAN_MAP[data?.plan?.plan_code ?? data?.plan_code] ?? null;
        if (identityId && plan) await activatePlan(fastify, identityId, plan, provider, { externalCustomerId: data?.customer?.customer_code, externalSubId: data?.subscription_code ?? data?.reference });
      }
      if (eventName === "subscription.not_renew" || eventName === "subscription.disable") {
        if (data?.metadata?.identityId) await downgradePlan(fastify, data.metadata.identityId, provider);
      }
    }
  } catch (err) {
    fastify.log.error({ err, provider }, "[BILLING] Event handler failed");
  }
}

async function activatePlan(fastify: FastifyInstance, identityId: string, plan: "FREE" | "PRO" | "ENTERPRISE", provider: BillingProvider, external: any) {
  await fastify.db.$transaction(async (tx) => {
    await tx.subscription.updateMany({ where: { identityId, status: "ACTIVE" }, data: { status: "CANCELED", endsAt: new Date() } });
    await tx.subscription.create({ data: { identityId, plan, status: "ACTIVE", provider, externalCustomerId: external.externalCustomerId, externalSubId: external.externalSubId } });
  });
  fastify.log.info({ identityId, plan, provider }, "[BILLING] Subscription activated");
}

async function downgradePlan(fastify: FastifyInstance, identityId: string, provider: BillingProvider) {
  await fastify.db.$transaction(async (tx) => {
    await tx.subscription.updateMany({ where: { identityId, status: "ACTIVE", provider }, data: { status: "CANCELED", endsAt: new Date() } });
    await tx.subscription.create({ data: { identityId, plan: "FREE", status: "ACTIVE" } });
  });
  fastify.log.info({ identityId, provider }, "[BILLING] Subscription downgraded to FREE");
}