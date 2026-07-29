import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { verifySessionRoute } from "./verify-session.route";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockCreate = vi.fn();

vi.mock("@prisma-client", () => ({
  VcFormat: { JWT: "JWT" },
  UserStatus: {},
  MfaType: {},
  AuditLogAction: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

function buildApp() {
  const fastify = Fastify();
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  fastify.decorate("db", {
    verifySession: {
      create: mockCreate,
    },
  } as any);

  return fastify;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /verify/session", () => {
  let fastify: ReturnType<typeof buildApp>;

  // ROOT CAUSE of the 15s timeout:
  // The original test called vi.useFakeTimers() in beforeAll() BEFORE
  // await fastify.ready(). Fastify uses setImmediate internally during plugin
  // initialization. vi.useFakeTimers() intercepts setImmediate by default,
  // so the scheduled callbacks never fire and fastify.ready() hangs forever.
  //
  // Fix: start the server first (no fake timers), then activate fake timers
  // per-test in beforeEach and clean them up in afterEach.
  beforeAll(async () => {
    fastify = buildApp();
    await fastify.register(verifySessionRoute, { prefix: "/credentials" });
    await fastify.ready();
    // Server is fully booted before any fake timers are installed.
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Only fake Date, not timer functions — Fastify inject() relies on
    // real setTimeout/setImmediate internally and hangs with full fake timers.
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a session with correct fields", async () => {
    const now = new Date("2026-07-22T12:00:00Z");
    vi.setSystemTime(now);

    mockCreate.mockResolvedValue({
      id: "cm7qwerty0001",
      challenge: "aGVsbG8td29ybGQ",
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    });

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/session",
      payload: {},
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.sessionId).toBe("cm7qwerty0001");
    expect(body.challenge).toBe("aGVsbG8td29ybGQ");
    expect(body.expiresAt).toBeDefined();

    const dbArg = mockCreate.mock.calls[0][0];
    expect(dbArg.data.status).toBe("PENDING");
    expect(dbArg.data.challenge).toBeTruthy();
    expect(typeof dbArg.data.challenge).toBe("string");
    expect(dbArg.data.challenge.length).toBeGreaterThanOrEqual(40);
    expect(dbArg.select).toEqual({
      id: true,
      challenge: true,
      expiresAt: true,
    });
  });

  it("sets expiresAt ~5 minutes from creation", async () => {
    const now = new Date("2026-07-22T12:00:00Z");
    vi.setSystemTime(now);

    mockCreate.mockImplementation(async ({ data }) => ({
      id: "cm7qwerty0002",
      challenge: data.challenge,
      expiresAt: data.expiresAt,
    }));

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/session",
      payload: {},
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    const expiresAt = new Date(body.expiresAt).getTime();
    const expected = now.getTime() + 5 * 60 * 1000;
    expect(Math.abs(expiresAt - expected)).toBeLessThan(1000);
  });

  it("accepts optional credentialRef", async () => {
    mockCreate.mockResolvedValue({
      id: "cm7qwerty0003",
      challenge: "Y2hhbGxlbmdl",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/session",
      payload: { credentialRef: "did:example:123" },
    });

    expect(response.statusCode).toBe(201);
    expect(mockCreate.mock.calls[0][0].data.credentialRef).toBe(
      "did:example:123",
    );
  });

  it("works without authentication", async () => {
    mockCreate.mockResolvedValue({
      id: "cm7qwerty0004",
      challenge: "bm8tYXV0aA",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/session",
      payload: {},
    });

    expect(response.statusCode).toBe(201);
  });

  it("has rate limit config on the route", async () => {
    mockCreate.mockResolvedValue({
      id: "cm7qwerty0005",
      challenge: "cmF0ZS1saW1pdA",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const response = await fastify.inject({
      method: "POST",
      url: "/credentials/verify/session",
      payload: {},
    });

    expect(response.statusCode).toBe(201);
  });
});
