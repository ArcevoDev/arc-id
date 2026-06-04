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
  const tenantId = req.identity.tenantId ?? "SYSTEM";
  const sub = await fastify.db.subscription.findUnique({ where: { tenantId } });
  return reply.send({ success: true, data: sub ?? null });
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

  fastify.post("/subscription/plan", {
  preHandler: fastify.auth.requireScope("admin:write"),
  schema: {
    body: z.object({ tenantId: z.string().cuid().optional(), plan: z.enum(["FREE", "PRO", "ENTERPRISE"]) }),
    response: { 200: z.object({ success: z.boolean(), data: z.any() }) }
  }
}, async (req, reply) => {
  const body = req.body as { tenantId?: string; plan: "FREE" | "PRO" | "ENTERPRISE" };
  const tenantId = body.tenantId ?? (req.identity.tenantId ?? "SYSTEM");
  const updated = await fastify.db.subscription.upsert({
    where: { tenantId },
    update: { plan: body.plan, status: "ACTIVE", updatedAt: new Date(), endsAt: null },
    create: { tenantId, plan: body.plan, status: "ACTIVE" },
  });
  return reply.send({ success: true, data: updated });
});
}

async function handleProviderEvent(fastify: FastifyInstance, provider: BillingProvider, event: any) {
  try {
    if (provider === "paystack") {
  const { event: eventName, data } = event;
  const tenantId = data?.metadata?.tenantId; // ensure your checkout sets this
  if (!tenantId) return;

  if (eventName === "subscription.create" || eventName === "charge.success") {
    const planCode = data?.plan?.plan_code ?? data?.plan_code;
    const plan = PAYSTACK_PLAN_MAP[planCode] ?? "PRO";
    await fastify.db.subscription.upsert({
      where: { tenantId },
      update: { plan, status: "ACTIVE", updatedAt: new Date(), endsAt: null },
      create: { tenantId, plan, status: "ACTIVE" },
    });
    await fastify.db.externalBillingIntegration.upsert({
      where: {
        providerName_externalSubId: {
          providerName: "PAYSTACK",
          externalSubId: data?.subscription_code ?? data?.reference ?? `paystack-${tenantId}`,
        },
      },
      update: {
        externalCustomerId: data?.customer?.customer_code ?? null,
        metadata: data ?? {},
        updatedAt: new Date(),
      },
      create: {
        subscriptionId: (await fastify.db.subscription.findUnique({ where: { tenantId }, select: { id: true } }))!.id,
        providerName: "PAYSTACK",
        externalCustomerId: data?.customer?.customer_code ?? null,
        externalSubId: data?.subscription_code ?? data?.reference ?? null,
        metadata: data ?? {},
      },
    });
  }

  if (eventName === "subscription.not_renew" || eventName === "subscription.disable") {
    await fastify.db.subscription.update({
      where: { tenantId },
      data: { status: "CANCELED", endsAt: new Date(), updatedAt: new Date() },
    });
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
