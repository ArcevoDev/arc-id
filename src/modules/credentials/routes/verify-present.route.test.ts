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
import { verifyPresentRoute } from "./verify-present.route";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSessionFindUnique = vi.fn();
const mockSessionUpdate = vi.fn();

vi.mock("@prisma-client", () => ({
  VcFormat: { JWT: "JWT" },
  UserStatus: {},
  MfaType: {},
  AuditLogAction: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

vi.mock("@/core/flows", () => ({
  FlowExecutor: vi.fn(),
  flowExecutor: {
    run: vi.fn(),
  },
}));

vi.mock("@/lib/security/jws-proof", () => ({
  verifyDetachedJws: vi.fn(),
}));

vi.mock("@/modules/credentials/flows/verify-credential.flow", () => ({
  verifyCredentialFlow: {
    name: "credentials:verify",
    inputSchema: { parse: (x: any) => x },
    execute: vi.fn(),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const fastify = Fastify();
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  fastify.decorate("db", {
    verifySession: {
      findUnique: mockSessionFindUnique,
      update: mockSessionUpdate,
    },
  } as any);

  return fastify;
}

function pendingSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-001",
    challenge: "original-challenge",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /verify/present", () => {
  let fastify: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    fastify = buildApp();
    await fastify.register(verifyPresentRoute, { prefix: "/credentials" });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 410 when session is CONSUMED", async () => {
    mockSessionFindUnique.mockResolvedValue(
      pendingSession({ status: "CONSUMED" }),
    );

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/present",
      payload: {
        sessionId: "session-001",
        credential: "payload",
        proof: "eyJhbGciOiJFUzI1NiIsImtpZCI6InBraWQifQ..sig",
      },
    });

    expect(response.statusCode).toBe(410);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("Gone");
  });

  it("returns 410 when session is EXPIRED", async () => {
    mockSessionFindUnique.mockResolvedValue(
      pendingSession({ status: "EXPIRED" }),
    );

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/present",
      payload: {
        sessionId: "session-001",
        credential: "payload",
        proof: "eyJhbGciOiJFUzI1NiIsImtpZCI6InBraWQifQ..sig",
      },
    });

    expect(response.statusCode).toBe(410);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("Gone");
  });

  it("returns 410 when session is past expiresAt", async () => {
    mockSessionFindUnique.mockResolvedValue(
      pendingSession({
        status: "PENDING",
        expiresAt: new Date(Date.now() - 10_000),
      }),
    );

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/present",
      payload: {
        sessionId: "session-001",
        credential: "payload",
        proof: "eyJhbGciOiJFUzI1NiIsImtpZCI6InBraWQifQ..sig",
      },
    });

    expect(response.statusCode).toBe(410);
    const body = JSON.parse(response.body);
    expect(body.error).toBe("Gone");
  });

  it("returns 404 when session does not exist", async () => {
    mockSessionFindUnique.mockResolvedValue(null);

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/present",
      payload: {
        sessionId: "session-nonexistent",
        credential: "payload",
        proof: "eyJhbGciOiJFUzI1NiIsImtpZCI6InBraWQifQ..sig",
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns { valid: false, reason } when proof is not parseable", async () => {
    mockSessionFindUnique.mockResolvedValue(pendingSession());

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/present",
      payload: {
        sessionId: "session-001",
        credential: "credential-string",
        proof: "not-a-jws",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("invalid_proof");
  });

  it("returns { valid: false } when verifyDetachedJws returns false", async () => {
    mockSessionFindUnique.mockResolvedValue(pendingSession());
    vi.mocked(
      (await import("@/lib/security/jws-proof")).verifyDetachedJws,
    ).mockResolvedValue(false);

    const validHeader = Buffer.from(
      JSON.stringify({
        alg: "ES256",
        kid: "did:key:z6MktafZzBqy#key-1",
        nonce: "x",
      }),
    ).toString("base64url");

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/present",
      payload: {
        sessionId: "session-001",
        credential: "credential-string",
        proof: `${validHeader}..signature`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("invalid_proof");
  });

  it("returns { valid: true, claims } on valid full flow", async () => {
    const session = pendingSession({ id: "session-valid-001" });
    mockSessionFindUnique.mockResolvedValue(session);

    vi.mocked(
      (await import("@/lib/security/jws-proof")).verifyDetachedJws,
    ).mockResolvedValue(true);
    vi.mocked((await import("@/core/flows")).flowExecutor.run).mockResolvedValue(
      {
        valid: true,
        claims: {
          sub: "did:key:test",
          vc: { credentialSubject: { name: "Alice" } },
        },
      },
    );
    mockSessionUpdate.mockResolvedValue({ ...session, status: "CONSUMED" });

    const validHeader = Buffer.from(
      JSON.stringify({
        alg: "ES256",
        kid: "did:key:z6MktafZzBqy#key-1",
        nonce: "original-challenge",
      }),
    ).toString("base64url");

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/present",
      payload: {
        sessionId: "session-valid-001",
        credential: "valid-credential-jwt",
        proof: `${validHeader}..signature`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.valid).toBe(true);
    expect(body.claims).toBeDefined();
    expect(body.claims.sub).toBe("did:key:test");
    expect(body.sessionId).toBe("session-valid-001");

    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { id: "session-valid-001" },
      data: { status: "CONSUMED" },
    });
  });

  it("returns { valid: false, reason } on credential verification failure", async () => {
    mockSessionFindUnique.mockResolvedValue(pendingSession());

    vi.mocked(
      (await import("@/lib/security/jws-proof")).verifyDetachedJws,
    ).mockResolvedValue(true);
    vi.mocked((await import("@/core/flows")).flowExecutor.run).mockResolvedValue(
      {
        valid: false,
        reason: "Credential has expired",
      },
    );

    const validHeader = Buffer.from(
      JSON.stringify({
        alg: "ES256",
        kid: "did:key:z6MktafZzBqy#key-1",
        nonce: "original-challenge",
      }),
    ).toString("base64url");

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/present",
      payload: {
        sessionId: "session-001",
        credential: "expired-credential",
        proof: `${validHeader}..signature`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("Credential has expired");
  });

  it("works without authentication", async () => {
    mockSessionFindUnique.mockResolvedValue(pendingSession());

    const validHeader = Buffer.from(
      JSON.stringify({
        alg: "ES256",
        kid: "did:key:z6MktafZzBqy#key-1",
        nonce: "x",
      }),
    ).toString("base64url");

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/present",
      payload: {
        sessionId: "session-001",
        credential: "credential-string",
        proof: `${validHeader}..signature`,
      },
    });

    expect(response.statusCode).toBe(200);
  });
});
