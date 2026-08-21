// src/modules/identity/routes/external-id.verify.test.ts
//
// Route-level tests for POST /external-ids/:id/verify and
// POST /external-ids/:id/confirm endpoints. Verifies the auth guard and
// that the route delegates to the correct flow with the right input + ctx.
// The flow logic itself is covered by the co-located flow tests.

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
import { externalIdRoute } from "./external-id.route";

vi.mock("@prisma-client", () => ({
  Prisma: {},
  PrismaClient: vi.fn(),
}));

vi.mock("@/core/flows", () => ({
  FlowExecutor: vi.fn(),
  flowExecutor: {
    run: vi.fn(),
  },
}))

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/notifications/notification.service", () => ({
  notificationService: {
    sendMfaCode: vi.fn().mockResolvedValue(undefined),
    sendMfaCodeSms: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/crypto", () => ({
  sha256: vi.fn(() => "mocked-hash"),
}));

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

describe("POST /external-ids/:id/verify", () => {
  let fastify: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    fastify = buildApp({ requireUserPasses: false });
    await fastify.register(externalIdRoute, { prefix: "/identity" });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without authentication", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/identity/external-ids/ext-1/verify",
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("POST /external-ids/:id/verify — authenticated", () => {
  let fastify: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    fastify = buildApp({ requireUserPasses: true });
    await fastify.register(externalIdRoute, { prefix: "/identity" });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to verifyExternalIdentifierFlow with identity context", async () => {
    const { flowExecutor } = await import("@/core/flows");
    (flowExecutor.run as any).mockResolvedValue({
      success: true,
      type: "email",
    });

    const response = await fastify.inject({
      method: "POST",
      url: "/identity/external-ids/ext-1/verify",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual({
      success: true,
      data: { success: true, type: "email" },
    });

    expect(flowExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({ name: "identity:verify-external-identifier" }),
      { id: "ext-1" },
      expect.objectContaining({
        identityId: "test-user",
        tenantId: "test-tenant",
        ip: expect.any(String),
      }),
    );
  });

  it("passes the :id param as flow input", async () => {
    const { flowExecutor } = await import("@/core/flows");
    (flowExecutor.run as any).mockResolvedValue({
      success: true,
      type: "phone",
    });

    await fastify.inject({
      method: "POST",
      url: "/identity/external-ids/another-id/verify",
    });

    expect(flowExecutor.run).toHaveBeenCalledWith(
      expect.any(Object),
      { id: "another-id" },
      expect.any(Object),
    );
  });
});

describe("POST /external-ids/:id/confirm — authenticated", () => {
  let fastify: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    fastify = buildApp({ requireUserPasses: true });
    await fastify.register(externalIdRoute, { prefix: "/identity" });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to confirmExternalIdentifierFlow with id + code", async () => {
    const { flowExecutor } = await import("@/core/flows");
    (flowExecutor.run as any).mockResolvedValue({
      id: "ext-1",
      verified: true,
    });

    const response = await fastify.inject({
      method: "POST",
      url: "/identity/external-ids/ext-1/confirm",
      payload: { code: "123456" },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual({
      success: true,
      data: { id: "ext-1", verified: true },
    });

    expect(flowExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "identity:confirm-external-identifier",
      }),
      { id: "ext-1", code: "123456" },
      expect.objectContaining({
        identityId: "test-user",
        tenantId: "test-tenant",
      }),
    );
  });

  it("returns 400 when code is not 6 digits", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/identity/external-ids/ext-1/confirm",
      payload: { code: "12345" },
    });

    expect(response.statusCode).toBe(400);
  });
});
