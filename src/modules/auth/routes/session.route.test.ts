import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { sessionRoute } from "./session.route";
import { createMockDb } from "@/test-utils/mock-db";
import { blockJti } from "@/lib/security/jti-blocklist";

vi.mock("@/lib/security/jti-blocklist", () => ({
  blockJti: vi.fn().mockResolvedValue(undefined),
}));

// The route's import chain reaches src/core/db/prisma.ts (buildClient →
// withTenantIsolation → client.$extends) when audit.service loads the real
// PrismaClient. Mock both like the other route-level tests do.
vi.mock("@/core/db/prisma", () => ({ prisma: {} }));
vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@prisma-client", () => ({
  VcFormat: { JWT: "JWT" },
  UserStatus: {},
  MfaType: {},
  AuditLogAction: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

const IDENTITY_ID = "identity-1";
const SESSION_ID = "a".repeat(40);

function buildApp() {
  const fastify = Fastify();
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  const db = createMockDb();

  // This route uses the array form of $transaction ([...ops]) — the default
  // createMockDb only handles the callback form. Resolve array elements.
  db.$transaction = vi.fn(async (ops: any[]) =>
    Promise.all((ops as any[]).map((op) => Promise.resolve(op))),
  );

  fastify.decorate("db", db);
  fastify.decorate("auth", {
    requireUser: async (req: any) => {
      req.identity = { id: IDENTITY_ID, tenantId: "SYSTEM" };
    },
    requireScope: vi.fn(),
    requirePlan: vi.fn(() => async () => {}),
    requireAal2: vi.fn(),
    requireElevated: vi.fn(),
    requirePermission: vi.fn(() => async () => {}),
  });

  return { fastify, db };
}

describe("DELETE /auth/sessions/:id", () => {
  let app: ReturnType<typeof buildApp>;
  let fastify: ReturnType<typeof buildApp>["fastify"];
  let db: ReturnType<typeof buildApp>["db"];

  beforeAll(async () => {
    app = buildApp();
    fastify = app.fastify;
    db = app.db;
    await fastify.register(sessionRoute, { prefix: "/auth" });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-22T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("revokes tokens and writes revokedJti rows for every live access token", async () => {
    const expiresAt = new Date("2026-07-22T12:15:00Z"); // 15 min remaining
    db.accessToken.findMany.mockResolvedValue([
      { jti: "jti-1", expiresAt },
      { jti: "jti-2", expiresAt },
    ]);

    const response = await fastify.inject({
      method: "DELETE",
      url: `/auth/sessions/${SESSION_ID}`,
    });

    expect(response.statusCode).toBe(200);

    // All three revocation updates run inside the transaction (array form).
    const txOps = db.$transaction.mock.calls[0][0] as any[];
    expect(Array.isArray(txOps)).toBe(true);
    expect(txOps.length).toBeGreaterThanOrEqual(3);

    // revokedJti.create is called once per live token — the durable DB half
    // of the invariant (previously missing — the gap this test locks in).
    expect(db.revokedJti.create).toHaveBeenCalledTimes(2);
    expect(db.revokedJti.create).toHaveBeenCalledWith({
      data: { jti: "jti-1", expiresAt },
    });
    expect(db.revokedJti.create).toHaveBeenCalledWith({
      data: { jti: "jti-2", expiresAt },
    });

    // blockJti is called for each token with the remaining TTL (900s).
    expect(blockJti).toHaveBeenCalledTimes(2);
    expect(blockJti).toHaveBeenCalledWith("jti-1", 900);
    expect(blockJti).toHaveBeenCalledWith("jti-2", 900);
  });

  it("skips revokedJti/blockJti when the session has no live access tokens", async () => {
    db.accessToken.findMany.mockResolvedValue([]);

    const response = await fastify.inject({
      method: "DELETE",
      url: `/auth/sessions/${SESSION_ID}`,
    });

    expect(response.statusCode).toBe(200);
    expect(db.revokedJti.create).not.toHaveBeenCalled();
    expect(blockJti).not.toHaveBeenCalled();
  });

  it("rejects a malformed session id", async () => {
    const response = await fastify.inject({
      method: "DELETE",
      url: "/auth/sessions/short",
    });

    expect(response.statusCode).toBe(400);
    expect(db.accessToken.updateMany).not.toHaveBeenCalled();
  });

  it("owner-scopes every revocation write with the requesting identityId", async () => {
    db.accessToken.findMany.mockResolvedValue([
      { jti: "jti-3", expiresAt: new Date("2026-07-22T12:15:00Z") },
    ]);

    const response = await fastify.inject({
      method: "DELETE",
      url: `/auth/sessions/${SESSION_ID}`,
    });

    expect(response.statusCode).toBe(200);

    // The three revocation writes must each be scoped to the requesting
    // identity — this is the ownership guarantee the route header documents
    // (a session ID alone must never let one user revoke another's session).
    expect(db.accessToken.updateMany).toHaveBeenCalledWith({
      where: { sessionId: SESSION_ID, identityId: IDENTITY_ID, revoked: false },
      data: { revoked: true },
    });
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { sessionId: SESSION_ID, identityId: IDENTITY_ID, revoked: false },
      data: { revoked: true, rotatedAt: expect.any(Date) },
    });
    expect(db.session.updateMany).toHaveBeenCalledWith({
      where: { id: SESSION_ID, identityId: IDENTITY_ID },
      data: { valid: false },
    });
  });
});
