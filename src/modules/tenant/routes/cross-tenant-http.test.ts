// src/modules/tenant/routes/cross-tenant-http.test.ts
//
// HTTP integration test proving cross-tenant isolation at the REST layer.
// Tenant A cannot read/write Tenant B's data through real route handlers.
//
// Uses the POST /credentials/revoke endpoint with real flowExecutor —
// the flow's tenant check (vc.issuer.tenantId !== ctx.tenantId) is a
// genuine end-to-end test, not a mock.

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 300_000 });
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { revokeRoute } from "@/modules/credentials/routes/revoke.route";

const TENANT_A = "tenant-a-001";
const TENANT_B = "tenant-b-002";
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => {
  const m: Record<string, any> = {};
  m.verifiableCredential = { findUnique: vi.fn() };
  m.bitstringStatusList = { update: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue({ id: "sl-1", maxSize: 131072, entries: [] }), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "sl-1", maxSize: 131072, entries: [] }) };
  m.statusListEntry = { update: vi.fn().mockResolvedValue({}), upsert: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) };
  m.auditLog = { create: vi.fn().mockResolvedValue({}) };
  m.webhookEndpoint = { findMany: vi.fn().mockResolvedValue([]) };
  m.webhookEvent = { create: vi.fn().mockResolvedValue({}) };
  m.$transaction = vi.fn(async (fn: (tx: any) => any) => fn(m));
  m.$disconnect = vi.fn();
  return m;
});

vi.mock("@/core/db/prisma", () => ({ prisma: mockDb }));

vi.mock("@prisma-client", () => ({
  VcFormat: { JWT: "JWT", LDP: "LDP" },
  UserStatus: {},
  MfaType: {},
  AuditLogAction: {
    CREDENTIAL_REVOKED: "CREDENTIAL_REVOKED",
  },
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

// Prevent webhook-dispatcher from loading its transitive deps during tests.
vi.mock("@/lib/webhooks/webhook-dispatcher", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp(tenantId: string) {
  const fastify = Fastify();
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  fastify.decorate("auth", {
    requireUser: vi.fn(async (req: any, _reply: any) => {
      req.identity = {
        id: "test-user",
        tenantId,
        scope: [],
        plan: "PRO",
      };
    }),
    requireScope: vi.fn(),
    requirePlan: vi.fn(
      () => async (req: any, _reply: any) => {
        req.identity = {
          id: "test-user",
          tenantId,
          scope: [],
          plan: "PRO",
        };
      },
    ),
    requireAal2: vi.fn(),
    requireElevated: vi.fn(),
    requirePermission: vi.fn(() => async () => {}),
  });

  fastify.decorate("db", mockDb as any);

  return fastify;
}

function makeCredential(issuerTenantId: string | null) {
  return {
    id: `urn:uuid:${VALID_UUID}`,
    issuer: { tenantId: issuerTenantId },
    statusListId: "sl-1",
    statusListIndex: 5,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Cross-tenant HTTP isolation — POST /credentials/revoke", () => {
  let tenantAApp: ReturnType<typeof buildApp>;
  let tenantBApp: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    tenantAApp = buildApp(TENANT_A);
    await tenantAApp.register(revokeRoute, { prefix: "/credentials" });
    await tenantAApp.ready();

    tenantBApp = buildApp(TENANT_B);
    await tenantBApp.register(revokeRoute, { prefix: "/credentials" });
    await tenantBApp.ready();
  }, 300_000);

  afterAll(async () => {
    await tenantAApp.close();
    await tenantBApp.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Tenant B cannot revoke Tenant A's credential — returns 404", async () => {
    mockDb.verifiableCredential.findUnique.mockResolvedValue(
      makeCredential(TENANT_A),
    );

    const response = await tenantBApp.inject({
      method: "POST",
      url: "/credentials/revoke",
      payload: { credentialId: VALID_UUID },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.message).toContain("Credential not found");
  });

  it("Tenant A can revoke Tenant A's credential — returns 200", async () => {
    mockDb.verifiableCredential.findUnique.mockResolvedValue(
      makeCredential(TENANT_A),
    );

    const response = await tenantAApp.inject({
      method: "POST",
      url: "/credentials/revoke",
      payload: { credentialId: VALID_UUID },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
  });

  it("Identity-owned credential (issuer.tenantId: null) bypasses tenant check", async () => {
    mockDb.verifiableCredential.findUnique.mockResolvedValue(
      makeCredential(null),
    );

    const response = await tenantAApp.inject({
      method: "POST",
      url: "/credentials/revoke",
      payload: { credentialId: VALID_UUID },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
  });
});
