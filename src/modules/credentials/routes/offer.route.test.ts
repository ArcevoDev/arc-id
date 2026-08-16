// src/modules/credentials/routes/offer.route.test.ts
//
// Proves route-level auth guards are enforced:
//   - POST /offers returns 403 without credential:offer permission
//   - POST /offers/:token/accept returns 401 without requireUser
//   - POST /offers/:token/accept returns 403 without credential:issue permission

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
import { offerRoute } from "./offer.route";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

// Mock issue-credential.flow early so none of its service deps load
vi.mock("@/modules/credentials/flows/issue-credential.flow", () => ({
  issueCredentialFlow: {
    name: "credentials:issue",
    inputSchema: { parse: (x: any) => x },
    execute: vi.fn().mockResolvedValue({
      credentialId: "mock-vc",
      credential: {},
    }),
  },
}));

vi.mock("@prisma-client", () => ({
  VcFormat: { JWT: "JWT", LDP: "LDP" },
  UserStatus: {},
  MfaType: {},
  AuditLogAction: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

vi.mock("@/core/flows", () => ({
  FlowExecutor: vi.fn(),
  flowExecutor: {
    run: vi.fn().mockResolvedValue({
      token: "mock-token",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    }),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp(options: {
  requireUserPasses: boolean;
  requirePlanPasses: boolean;
  offerPermissionGranted: boolean;
  issuePermissionGranted: boolean;
}) {
  const fastify = Fastify();
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  // Populate req.identity on every request (mirrors the real app's global auth hook).
  // Guards that independently set req.identity (requireUser) will override this.
  fastify.addHook("onRequest", async (req: any) => {
    if (options.requireUserPasses) {
      req.identity = {
        id: "test-user",
        tenantId: "test-tenant",
        scope: [],
        plan: options.requirePlanPasses ? "PRO" : "FREE",
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
        plan: options.requirePlanPasses ? "PRO" : "FREE",
      };
    }),
    requireScope: vi.fn(),
    requirePlan: vi.fn((_minPlan: string) => async (_req: any, _reply: any) => {
      if (!options.requirePlanPasses) {
        _reply.status(402).send({
          success: false,
          error: "UPGRADE_REQUIRED",
          message: `This feature requires a PRO subscription`,
          currentPlan: "FREE",
          requiredPlan: "PRO",
        });
      }
    }),
    requireAal2: vi.fn(),
    requireElevated: vi.fn(),
    requirePermission: vi.fn(
      (action: string) => async (_req: any, _reply: any) => {
        const granted =
          (action === "credential:offer" && options.offerPermissionGranted) ||
          (action === "credential:issue" && options.issuePermissionGranted);
        if (!granted) {
          throw ApiError.forbidden(`Permission '${action}' is required`);
        }
      },
    ),
  });

  fastify.decorate("db", {} as any);

  return fastify;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /offers — requirePermission('credential:offer')", () => {
  let fastify: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    fastify = buildApp({
      requireUserPasses: true,
      requirePlanPasses: true,
      offerPermissionGranted: false,
      issuePermissionGranted: false,
    });
    await fastify.register(offerRoute, { prefix: "/credentials" });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 without credential:offer permission", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/offers",
      payload: {
        subjectDid: "did:key:test",
        format: "JWT",
        credentialSubject: { name: "Alice" },
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.message).toContain("credential:offer");
  });
});

describe("POST /offers — with credential:offer permission", () => {
  let fastify: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    fastify = buildApp({
      requireUserPasses: true,
      requirePlanPasses: true,
      offerPermissionGranted: true,
      issuePermissionGranted: false,
    });
    await fastify.register(offerRoute, { prefix: "/credentials" });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 with credential:offer granted", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/offers",
      payload: {
        subjectDid: "did:key:z6MktafZzBqy3zNfH1j5RqvMpvKmcxgZ5QYnEpP9cXnvZ1p2",
        holderId: "cusertest000001holder1",
        format: "JWT",
        credentialSubject: { name: "Alice", degree: "BSc" },
        schemaId: "degree-schema-v1",
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.expiresAt).toBeDefined();
  });
});

describe("POST /offers/:token/accept — requireUser", () => {
  let fastify: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    fastify = buildApp({
      requireUserPasses: false,
      requirePlanPasses: false,
      offerPermissionGranted: false,
      issuePermissionGranted: false,
    });
    await fastify.register(offerRoute, { prefix: "/credentials" });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("returns 401 without authentication", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/offers/550e8400-e29b-41d4-a716-446655440000/accept",
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("POST /offers/:token/accept — requirePermission('credential:issue')", () => {
  let fastify: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    fastify = buildApp({
      requireUserPasses: true,
      requirePlanPasses: true,
      offerPermissionGranted: false,
      issuePermissionGranted: false,
    });
    await fastify.register(offerRoute, { prefix: "/credentials" });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("returns 403 without credential:issue permission", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/offers/550e8400-e29b-41d4-a716-446655440000/accept",
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.message).toContain("credential:issue");
  });
});

describe("POST /offers/:token/accept — both gates pass", () => {
  let fastify: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    fastify = buildApp({
      requireUserPasses: true,
      requirePlanPasses: true,
      offerPermissionGranted: false,
      issuePermissionGranted: true,
    });
    const { flowExecutor } = await import("@/core/flows");
    (flowExecutor.run as any).mockResolvedValue({
      credentialId: "vc-001",
      credential: { "@context": [], type: ["VerifiableCredential"] },
    });
    await fastify.register(offerRoute, { prefix: "/credentials" });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("returns 201 when authenticated with credential:issue", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/offers/550e8400-e29b-41d4-a716-446655440000/accept",
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.credentialId).toBe("vc-001");
  });
});
