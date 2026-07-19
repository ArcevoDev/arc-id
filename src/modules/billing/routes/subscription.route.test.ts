// Tests for Phase 1a: Free-upgrade bypass fix
//
// Proves:
//   1. POST /subscription/upgrade returns 410 Gone
//   2. SubscriptionService.upgrade() does not exist
//   3. activateFromProvider (webhook path) still works
//   4. Audit logging fires on webhook-driven tier changes

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

// ── Hoisted mocks (must run before imports) ──────────────────────────────────

const mockAuditLog = vi.hoisted(() => vi.fn());

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: mockAuditLog },
}));

vi.mock("@/core/config", () => ({
  config: {
    billing: {
      paystack: { webhookSecret: "test-paystack-secret" },
      stripe: { webhookSecret: "test-stripe-secret" },
    },
  },
}));

const mockDb = vi.hoisted(() => {
  function modelProxy(name: string) {
    return new Proxy<Record<string, ReturnType<typeof vi.fn>>>({} as any, {
      get(target, key: string) {
        if (!target[key]) target[key] = vi.fn();
        return target[key];
      },
    });
  }
  const mock: Record<string, any> = {};
  mock.subscription = modelProxy("subscription");
  mock.externalBillingIntegration = modelProxy("externalBillingIntegration");
  mock.auditLog = modelProxy("auditLog");
  mock.$transaction = vi.fn(async (fn: (tx: any) => any) => fn(mock));
  mock.$disconnect = vi.fn();
  return mock;
});

vi.mock("@/core/db", () => ({ prisma: mockDb }));
vi.mock("@prisma-client", () => ({
  SubscriptionPlan: { FREE: "FREE", PRO: "PRO", ENTERPRISE: "ENTERPRISE" },
  SubscriptionStatus: {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    CANCELED: "CANCELED",
    EXPIRED: "EXPIRED",
  },
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
}));

// ── Imports (after all hoisted mocks) ────────────────────────────────────────

import { subscriptionRoute } from "./subscription.route";
import { SubscriptionService } from "../services/subscription.service";
import { createHmac } from "crypto";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const fastify = Fastify();
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);
  fastify.decorate("auth", {
    requireUser: vi.fn(async (req: any) => {
      req.identity = { id: "test-user", tenantId: "test-tenant" };
    }),
    requireScope: vi.fn(),
    requirePlan: vi.fn(),
    requireAal2: vi.fn(),
    requireElevated: vi.fn(),
    requirePermission: vi.fn(
      (_action: string) => async (_req: any, _reply: any) => {
        /* no-op — subscription routes predate RBAC */
      },
    ),
  });
  fastify.decorate("db", mockDb as any);

  // Webhook routes use config: { rawBody: true } and (req as any).rawBody.
  // Register a JSON content-type parser that also captures the raw body.
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    function (
      _req: any,
      body: string,
      done: (err: Error | null, parsed: any) => void,
    ) {
      _req.rawBody = body;
      done(null, JSON.parse(body));
    },
  );

  return fastify;
}

function paystackSignature(payload: string): string {
  return createHmac("sha512", "test-paystack-secret")
    .update(payload)
    .digest("hex");
}

function stripeSignature(payload: string): string {
  return createHmac("sha256", "test-stripe-secret")
    .update(payload)
    .digest("hex");
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Phase 1a: Free-upgrade bypass fix", () => {
  let fastify: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    fastify = buildApp();
    await fastify.register(subscriptionRoute);
    await fastify.ready();
  }, 120_000);

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.mockClear();
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb));
  });

  // ── POST /subscription/upgrade ─────────────────────────────────────────────

  describe("POST /subscription/upgrade", () => {
    it("returns 410 Gone with UPGRADE_ENDPOINT_REMOVED code", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/subscription/upgrade",
        payload: { plan: "ENTERPRISE" },
      });

      expect(response.statusCode).toBe(410);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("UPGRADE_ENDPOINT_REMOVED");
      expect(body.error).toContain("payment provider");
    });

    it("does not modify subscription in the database", async () => {
      await fastify.inject({
        method: "POST",
        url: "/subscription/upgrade",
        payload: { plan: "ENTERPRISE" },
      });

      expect(mockDb.subscription.upsert).not.toHaveBeenCalled();
      expect(mockDb.subscription.update).not.toHaveBeenCalled();
      expect(mockDb.subscription.create).not.toHaveBeenCalled();
    });
  });

  // ── SubscriptionService ────────────────────────────────────────────────────

  describe("SubscriptionService", () => {
    it("no longer exposes upgrade() method", () => {
      const service = new SubscriptionService(mockDb as any);
      expect((service as any).upgrade).toBeUndefined();
    });

    it("activateFromProvider upserts subscription and creates billing integration", async () => {
      mockDb.subscription.upsert.mockResolvedValue({
        id: "sub-1",
        plan: "PRO",
        status: "ACTIVE",
        tenantId: "tenant-1",
      });
      mockDb.externalBillingIntegration.upsert.mockResolvedValue({
        id: "ebi-1",
      });

      const service = new SubscriptionService(mockDb as any);
      const result = await service.activateFromProvider(
        "tenant-1",
        "PRO" as any,
        "PAYSTACK",
        "cust-123",
        "sub-code-456",
      );

      expect(mockDb.$transaction).toHaveBeenCalled();
      expect(mockDb.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "tenant-1" },
          create: expect.objectContaining({
            plan: "PRO",
            tenantId: "tenant-1",
          }),
        }),
      );
      expect(mockDb.externalBillingIntegration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            providerName_externalSubId: {
              providerName: "PAYSTACK",
              externalSubId: "sub-code-456",
            },
          },
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ plan: "PRO", tenantId: "tenant-1" }),
      );
    });

    it("activateFromProvider without externalSubId skips billing integration", async () => {
      mockDb.subscription.upsert.mockResolvedValue({
        id: "sub-2",
        plan: "ENTERPRISE",
        status: "ACTIVE",
        tenantId: "tenant-2",
      });

      const service = new SubscriptionService(mockDb as any);
      await service.activateFromProvider(
        "tenant-2",
        "ENTERPRISE" as any,
        "STRIPE",
      );

      expect(mockDb.externalBillingIntegration.upsert).not.toHaveBeenCalled();
    });

    it("cancelFromProvider reverts plan to FREE", async () => {
      mockDb.subscription.update.mockResolvedValue({
        id: "sub-3",
        plan: "FREE",
        status: "ACTIVE",
        tenantId: "tenant-1",
      });

      const service = new SubscriptionService(mockDb as any);
      await service.cancelFromProvider("tenant-1");

      expect(mockDb.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "tenant-1" },
          data: expect.objectContaining({ plan: "FREE", status: "ACTIVE" }),
        }),
      );
    });
  });

  // ── Audit logging on webhook-driven changes ────────────────────────────────

  describe("Audit logging on webhook-driven tier changes", () => {
    it("Paystack webhook activation calls auditService.log with SUBSCRIPTION_UPGRADED", async () => {
      mockDb.subscription.upsert.mockResolvedValue({
        id: "sub-1",
        plan: "PRO",
        status: "ACTIVE",
      });
      mockDb.externalBillingIntegration.upsert.mockResolvedValue({
        id: "ebi-1",
      });

      const payload = JSON.stringify({
        event: "subscription.create",
        data: {
          plan: { plan_code: "PLN_arcid_pro" },
          customer: {
            customer_code: "CUS_xxx",
            metadata: { tenantId: "tenant-1" },
          },
          subscription_code: "SUB_xxx",
          metadata: { tenantId: "tenant-1" },
        },
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/webhooks/billing/paystack",
        headers: {
          "content-type": "application/json",
          "x-paystack-signature": paystackSignature(payload),
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SUBSCRIPTION_UPGRADED",
          tenantId: "tenant-1",
          metadata: expect.objectContaining({
            plan: "PRO",
            provider: "PAYSTACK",
          }),
        }),
      );
    });

    it("Paystack webhook cancellation calls auditService.log with SUBSCRIPTION_CANCELLED", async () => {
      mockDb.subscription.update.mockResolvedValue({
        id: "sub-1",
        plan: "FREE",
        status: "ACTIVE",
      });

      const payload = JSON.stringify({
        event: "subscription.disable",
        data: {
          customer: { metadata: { tenantId: "tenant-1" } },
          metadata: { tenantId: "tenant-1" },
        },
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/webhooks/billing/paystack",
        headers: {
          "content-type": "application/json",
          "x-paystack-signature": paystackSignature(payload),
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SUBSCRIPTION_CANCELLED",
          tenantId: "tenant-1",
          metadata: expect.objectContaining({ provider: "PAYSTACK" }),
        }),
      );
    });

    it("Stripe webhook activation calls auditService.log with SUBSCRIPTION_UPGRADED", async () => {
      mockDb.subscription.upsert.mockResolvedValue({
        id: "sub-1",
        plan: "PRO",
        status: "ACTIVE",
      });
      mockDb.externalBillingIntegration.upsert.mockResolvedValue({
        id: "ebi-1",
      });

      const payload = JSON.stringify({
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_stripe_xxx",
            customer: "cus_xxx",
            metadata: { tenantId: "tenant-1" },
            items: { data: [{ price: { id: "price_arcid_pro" } }] },
          },
        },
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/webhooks/billing/stripe",
        headers: {
          "content-type": "application/json",
          "stripe-signature": stripeSignature(payload),
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SUBSCRIPTION_UPGRADED",
          tenantId: "tenant-1",
          metadata: expect.objectContaining({
            plan: "PRO",
            provider: "STRIPE",
          }),
        }),
      );
    });

    it("Stripe webhook cancellation calls auditService.log with SUBSCRIPTION_CANCELLED", async () => {
      mockDb.subscription.update.mockResolvedValue({
        id: "sub-1",
        plan: "FREE",
        status: "ACTIVE",
      });

      const payload = JSON.stringify({
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_stripe_xxx",
            customer: "cus_xxx",
            metadata: { tenantId: "tenant-1" },
          },
        },
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/webhooks/billing/stripe",
        headers: {
          "content-type": "application/json",
          "stripe-signature": stripeSignature(payload),
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SUBSCRIPTION_CANCELLED",
          tenantId: "tenant-1",
          metadata: expect.objectContaining({ provider: "STRIPE" }),
        }),
      );
    });

    it("webhook with bad HMAC signature returns 401", async () => {
      const payload = JSON.stringify({
        event: "subscription.create",
        data: {},
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/webhooks/billing/paystack",
        headers: {
          "content-type": "application/json",
          "x-paystack-signature": "badsignature",
        },
        payload,
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
