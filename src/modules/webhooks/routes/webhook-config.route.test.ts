// src/modules/webhooks/routes/webhook-config.route.test.ts
//
// Proves the route-level requirePermission("webhook:manage") preHandler works:
//   - A caller without "webhook:manage" gets 403 on PATCH and DELETE
//   - A caller with "webhook:manage" can PATCH and DELETE successfully

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { ApiError } from "@/core/errors/api-error";
import { webhookConfigRoute } from "./webhook-config.route";

// ── Hoisted mocks (must run before vi.mock hoisting) ─────────────────────────

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
  mock.webhookEndpoint = modelProxy("webhookEndpoint");
  mock.webhookEvent = modelProxy("webhookEvent");
  mock.$transaction = vi.fn(async (fn: (tx: any) => any) => fn(mock));
  mock.$disconnect = vi.fn();
  return mock;
});

const mockAuditLog = vi.hoisted(() => vi.fn());

vi.mock("@/core/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: mockAuditLog },
}));
vi.mock("@/lib/url-safety", () => ({
  assertSafeUrl: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp(permissionGranted: boolean) {
  const fastify = Fastify();
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  // requireUser is the base guard — sets req.identity.  requirePlan and
  // requirePermission both call it internally in the real auth guard, so
  // our mocks chain through it to simulate the same setup.
  const mockRequireUser = vi.fn(async (req: any, _reply: any) => {
    req.identity = {
      id: "test-user",
      tenantId: "test-tenant",
      scope: [],
      plan: "PRO",
    };
  });

  fastify.decorate("auth", {
    requireUser: mockRequireUser,
    requireScope: vi.fn(),
    requirePlan: vi.fn(
      () => async (req: any, reply: any) => mockRequireUser(req, reply),
    ),
    requireAal2: vi.fn(),
    requireElevated: vi.fn(),
    requirePermission: vi.fn(
      (_action: string) => async (req: any, reply: any) => {
        await mockRequireUser(req, reply);
        if (!permissionGranted) {
          throw ApiError.forbidden(`Permission '${_action}' is required`);
        }
      },
    ),
  });
  fastify.decorate("db", mockDb as any);

  return fastify;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Webhook config route — requirePermission('webhook:manage')", () => {
  let fastify: ReturnType<typeof buildApp>;
  const endpointId = "clweb000001testendpoint1";

  beforeAll(async () => {
    fastify = buildApp(false);
    await fastify.register(webhookConfigRoute, { prefix: "/webhooks" });
    await fastify.ready();
  }, 120_000);

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.mockClear();
  });

  describe("PATCH /webhooks/endpoints/:id — without 'webhook:manage'", () => {
    it("returns 403", async () => {
      const response = await fastify.inject({
        method: "PATCH",
        url: `/webhooks/endpoints/${endpointId}`,
        payload: { enabled: false },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("webhook:manage");
    });
  });

  describe("DELETE /webhooks/endpoints/:id — without 'webhook:manage'", () => {
    it("returns 403", async () => {
      const response = await fastify.inject({
        method: "DELETE",
        url: `/webhooks/endpoints/${endpointId}`,
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("webhook:manage");
    });
  });

  describe("with 'webhook:manage' permission", () => {
    beforeAll(async () => {
      await fastify.close();
      fastify = buildApp(true);
      await fastify.register(webhookConfigRoute, { prefix: "/webhooks" });
      await fastify.ready();
    }, 120_000);

    it("PATCH succeeds (200) when endpoint exists and belongs to the tenant", async () => {
      mockDb.webhookEndpoint.findFirst.mockResolvedValue({
        id: endpointId,
        tenantId: "test-tenant",
        url: "https://example.com/hook",
      });
      mockDb.webhookEndpoint.update.mockResolvedValue({
        id: endpointId,
        url: "https://example.com/hook",
        eventTypes: [],
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await fastify.inject({
        method: "PATCH",
        url: `/webhooks/endpoints/${endpointId}`,
        payload: { enabled: false },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("PATCH returns 404 when endpoint does not exist", async () => {
      mockDb.webhookEndpoint.findFirst.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "PATCH",
        url: `/webhooks/endpoints/${endpointId}`,
        payload: { enabled: false },
      });

      expect(response.statusCode).toBe(404);
    });

    it("DELETE succeeds (200) when endpoint exists and belongs to the tenant", async () => {
      mockDb.webhookEndpoint.findFirst.mockResolvedValue({
        id: endpointId,
        tenantId: "test-tenant",
      });
      mockDb.webhookEndpoint.delete.mockResolvedValue({
        id: endpointId,
      });

      const response = await fastify.inject({
        method: "DELETE",
        url: `/webhooks/endpoints/${endpointId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("DELETE returns 404 when endpoint does not exist", async () => {
      mockDb.webhookEndpoint.findFirst.mockResolvedValue(null);

      const response = await fastify.inject({
        method: "DELETE",
        url: `/webhooks/endpoints/${endpointId}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
