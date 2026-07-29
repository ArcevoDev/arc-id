// src/modules/credentials/routes/list.route.test.ts
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
import { listRoute } from "./list.route";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

vi.mock("@prisma-client", () => ({
  VcFormat: {},
  UserStatus: {},
  MfaType: {},
  AuditLogAction: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

vi.mock("@/core/flows", () => ({
  FlowExecutor: vi.fn(),
  flowExecutor: {
    run: vi.fn().mockResolvedValue([
      {
        id: "vc-001",
        format: "JWT",
        issuerDid: "did:web:test.arcevocirqle.com.ng",
        subjectDid: "did:key:z6MktafZ",
        issuedAt: new Date("2026-07-22T12:00:00Z"),
        expiresAt: new Date("2027-07-22T12:00:00Z"),
        credentialSubject: { name: "Alice" },
      },
    ]),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp(options: { requireUserPasses: boolean }) {
  const fastify = Fastify();
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  fastify.addHook("onRequest", async (req: any) => {
    if (options.requireUserPasses) {
      req.identity = {
        id: "test-user",
        tenantId: "test-tenant",
        scope: [],
      };
    }
  });

  fastify.decorate("auth", {
    requireUser: vi.fn(async (req: any) => {
      if (!options.requireUserPasses) {
        throw ApiError.unauthorized("Invalid or expired access token");
      }
      req.identity = {
        id: "test-user",
        tenantId: "test-tenant",
        scope: [],
      };
    }),
    requireScope: vi.fn(),
    requirePlan: vi.fn(() => async () => {}),
    requireAal2: vi.fn(),
    requireElevated: vi.fn(),
    requirePermission: vi.fn(() => async () => {}),
  });

  fastify.decorate("db", {} as any);

  return fastify;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GET /credentials — requireUser guard", () => {
  let fastify: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    fastify = buildApp({ requireUserPasses: false });
    await fastify.register(listRoute, { prefix: "/credentials" });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("returns 401 without authentication", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/credentials",
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("GET /credentials — authenticated", () => {
  let fastify: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    fastify = buildApp({ requireUserPasses: true });
    await fastify.register(listRoute, { prefix: "/credentials" });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with credentials list", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/credentials",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: "vc-001",
      format: "JWT",
      issuerDid: "did:web:test.arcevocirqle.com.ng",
    });
  });

  it("passes identity context to flowExecutor.run", async () => {
    const { flowExecutor } = await import("@/core/flows");

    await fastify.inject({
      method: "GET",
      url: "/credentials",
    });

    expect(flowExecutor.run).toHaveBeenCalledWith(
      expect.any(Object),
      {},
      expect.objectContaining({
        identityId: "test-user",
        tenantId: "test-tenant",
      }),
    );
  });

  it("returns empty data array when no credentials held", async () => {
    const { flowExecutor } = await import("@/core/flows");
    (flowExecutor.run as any).mockResolvedValue([]);

    const response = await fastify.inject({
      method: "GET",
      url: "/credentials",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
  });
});
