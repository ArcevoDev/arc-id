// src/modules/tenant/routes/did.route.test.ts
//
// Proves the route-level requirePermission("did:manage") preHandler works:
//   - A caller without "did:manage" gets 403
//   - A caller with "did:manage" passes through to the handler

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
import { tenantDidRoute } from "./did.route";

// ── Hoisted mock DB (must run before vi.mock hoisting) ───────────────────────

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
  mock.tenantMembership = modelProxy("tenantMembership");
  mock.decentralizedIdentifier = modelProxy("decentralizedIdentifier");
  mock.tenantSigningKey = modelProxy("tenantSigningKey");
  mock.$transaction = vi.fn(async (fn: (tx: any) => any) => fn(mock));
  mock.$disconnect = vi.fn();
  return mock;
});

vi.mock("@/core/db", () => ({ prisma: mockDb }));

// Prevent jose from doing real crypto — return fixed values
vi.mock("jose", () => ({
  generateKeyPair: vi.fn().mockResolvedValue({
    publicKey: "mock-public-key",
    privateKey: "mock-private-key",
  }),
  exportSPKI: vi
    .fn()
    .mockResolvedValue(
      "-----BEGIN PUBLIC KEY-----\nmock-spki-key\n-----END PUBLIC KEY-----",
    ),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp(permissionGranted: boolean) {
  const fastify = Fastify();
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  fastify.decorate("auth", {
    requireUser: vi.fn(async (req: any) => {
      req.identity = {
        id: "test-user",
        tenantId: "test-tenant",
        scope: [],
        plan: "PRO",
      };
    }),
    requireScope: vi.fn(),
    requirePlan: vi.fn(() => async () => {}),
    requireAal2: vi.fn(),
    requireElevated: vi.fn(),
    requirePermission: vi.fn(
      (_action: string) => async (_req: any, _reply: any) => {
        if (!permissionGranted) {
          throw ApiError.forbidden("Permission 'did:manage' is required");
        }
      },
    ),
  });
  fastify.decorate("db", mockDb as any);

  return fastify;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DID route — requirePermission('did:manage')", () => {
  let fastify: ReturnType<typeof buildApp>;
  const tenantId = "cltenant000001testtenant1";

  beforeAll(async () => {
    fastify = buildApp(false);
    await fastify.register(tenantDidRoute, { prefix: "/tenants" });
    await fastify.ready();
  }, 30_000);

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("without 'did:manage' permission", () => {
    it("POST /tenants/:tenantId/did returns 403", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: `/tenants/${tenantId}/did`,
        payload: { domain: "example.com" },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("did:manage");
    });
  });

  describe("with 'did:manage' permission", () => {
    beforeAll(async () => {
      await fastify.close();
      fastify = buildApp(true);
      await fastify.register(tenantDidRoute, { prefix: "/tenants" });
      await fastify.ready();
    }, 30_000);

    it("POST /tenants/:tenantId/did returns 201 when no DID exists", async () => {
      mockDb.decentralizedIdentifier.findUnique.mockResolvedValue(null);
      mockDb.decentralizedIdentifier.create.mockResolvedValue({
        id: "did:web:example.com",
        tenantId,
        publicKeyBytes: Buffer.from("mock-key"),
        keyType: "JsonWebKey2020",
        didDocument: { "@context": [], id: "did:web:example.com" },
      });

      const response = await fastify.inject({
        method: "POST",
        url: `/tenants/${tenantId}/did`,
        payload: { domain: "example.com" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.did).toBe("did:web:example.com");
    });

    it("POST /tenants/:tenantId/did returns 409 when DID already exists", async () => {
      mockDb.decentralizedIdentifier.findUnique.mockResolvedValue({
        id: "did:web:existing.com",
      });

      const response = await fastify.inject({
        method: "POST",
        url: `/tenants/${tenantId}/did`,
        payload: { domain: "example.com" },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("CONFLICT");
    });
  });
});
