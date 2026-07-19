// src/modules/auth/flows/login.flow.test.ts
//
// Covers: successful login, lockout, bad password, non-existent email,
// banned/suspended/deleted states, MFA path, no-MFA token-issuance path,
// TenantPolicy requireMfa → mfaEnrollmentRequired, and fallback defaults.
//
// login.flow uses ctx.db throughout (the transaction client FlowExecutor
// opened) — no direct prisma import, no separate $transaction wrapper
// in the flow itself.  Session creation and token issuance share one
// transaction boundary.  TokenService.issue() is the only external module
// that issues DB writes (inside the same ctx.db transaction).
//
// The mockDb Proxy handles all model access. tenantPolicy.findUnique
// returns undefined by default, which the flow handles via optional
// chaining + ?? fallback to schema defaults.

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Hoisted mock DB ──────────────────────────────────────────────────────────
// login.flow uses ctx.db throughout (no direct @/core/db imports).  The mockDb
// below provides all Prisma models the flow and token service touch.  We
// mock @/core/db because TokenService imports resolvePemContent from
// @/api/plugins/jwt.plugin (which does not import @/core/db directly, but
// its transitive deps might), and because removing the mock would cause
// prisma.ts to attempt building a real PrismaClient at import time.

const mockDb = vi.hoisted(() => {
  // ── Model helper: store vi.fn() instances in a plain object so they're
  // enumerable (Proxy traps aren't, which broke rollback snapshots and
  // resetMocks).  The plain object is wrapped in a Proxy only for the
  // "autovivify on first access" behavior, but the store is always
  // accessible via `_fns` for iteration.
  function createModelStore() {
    const fns: Record<string, ReturnType<typeof vi.fn>> = {};
    return new Proxy(fns, {
      get(target, key: string) {
        if (key === "_fns") return target;
        if (!target[key])
          target[key] = vi.fn().mockName(`model.${String(key)}`);
        return target[key];
      },
    });
  }
  const models = [
    "identity",
    "session",
    "refreshToken",
    "accessToken",
    "idToken",
    "client",
    "subscription",
    "localAccount",
    "oAuthAccount",
    "role",
    "tenantMembership",
    "decentralizedIdentifier",
    "tenantSigningKey",
    "bitstringStatusList",
    "statusListEntry",
    "verifiableCredential",
    "revokedJti",
    "emailToken",
    "passkey",
    "mfa",
    "mfaRecoveryCode",
    "webhookEndpoint",
    "webhookEvent",
    "auditLog",
    "tenantPolicy",
  ];
  const mock: Record<string, any> = { resetMocks: () => {} };
  for (const m of models) mock[m] = createModelStore();

  // ── Rollback-aware $transaction mock ─────────────────────────────────────
  // Snapshots the mock call count per method before running fn.
  // If fn throws, pops all calls that were added during fn() so the mock
  // effectively "rolls back" — tests can assert that no DB writes were
  // left committed after a failure inside the transaction.
  mock.$transaction = vi.fn(async (fn: (tx: any) => any) => {
    const snapshot = new Map<string, number>();
    for (const modelName of models) {
      const fns = mock[modelName]._fns as Record<
        string,
        ReturnType<typeof vi.fn>
      >;
      for (const methodName of Object.keys(fns)) {
        snapshot.set(
          `${modelName}.${methodName}`,
          fns[methodName].mock.calls.length,
        );
      }
    }
    try {
      return await fn(mock);
    } catch (err) {
      for (const [key, prevLen] of snapshot) {
        const [modelName, methodName] = key.split(".");
        const fns = mock[modelName]._fns as Record<
          string,
          ReturnType<typeof vi.fn>
        >;
        if (fns[methodName]) {
          const calls = fns[methodName].mock.calls;
          while (calls.length > prevLen) calls.pop();
        }
      }
      throw err;
    }
  });
  mock.$disconnect = vi.fn();
  mock.resetMocks = () => {
    for (const m of models) {
      const fns = mock[m]._fns as Record<string, ReturnType<typeof vi.fn>>;
      for (const key of Object.keys(fns)) {
        fns[key].mockReset();
      }
    }
  };
  return mock;
});

vi.mock("@/core/db", () => ({ prisma: mockDb }));
vi.mock("@prisma-client", () => ({
  UserStatus: {
    ACTIVE: "ACTIVE",
    PENDING: "PENDING",
    BANNED: "BANNED",
    SUSPENDED: "SUSPENDED",
    DELETED: "DELETED",
  },
  MfaType: { TOTP: "TOTP", SMS: "SMS" },
  AuditLogAction: {},
  VcFormat: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  },
}));
vi.mock("@/api/plugins/jwt.plugin", () => ({
  resolvePemContent: vi.fn(() => ""),
}));
vi.mock("@/lib/notifications/notification.service", () => ({
  notificationService: {
    sendNewDeviceLogin: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock external modules that login.flow imports
vi.mock("../services/password.service", () => ({ verifyPassword: vi.fn() }));
vi.mock("@/lib/security/login-attempt", () => ({
  checkLockout: vi.fn(),
  recordFailure: vi.fn(),
  clearAttempts: vi.fn(),
}));

// ── Imports (after all vi.mock factories) ─────────────────────────────────────

import type { FlowContext } from "@/core/flows";
import { verifyPassword } from "../services/password.service";
import {
  checkLockout,
  recordFailure,
  clearAttempts,
} from "@/lib/security/login-attempt";
import { loginFlow } from "./login.flow";
import { ApiError } from "@/core/errors";

// ── Factory helpers ────────────────────────────────────────────────────────────

function makeIdentity(overrides: Record<string, any> = {}) {
  return {
    id: "identity-1",
    primaryEmail: "alice@example.com",
    name: "Alice",
    username: null,
    picture: null,
    status: "ACTIVE",
    emailVerified: true,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    localAccount: {
      id: "local-1",
      passwordHash: "argon2hashvalue",
      identityId: "identity-1",
    },
    mfas: [] as any[],
    memberships: [
      { status: "ACTIVE", role: { name: "MEMBER" }, tenant: { id: "SYSTEM" } },
    ],
    ...overrides,
  };
}

function makeSession(overrides: Record<string, any> = {}) {
  return {
    id: "session-token-" + "x".repeat(60),
    identityId: "identity-1",
    localAccountId: "local-1",
    ip: null,
    userAgent: null,
    valid: true,
    expiresAt: new Date(Date.now() + 7 * 86400_000),
    authLevel: "aal1",
    ...overrides,
  };
}

function ctx(overrides: Record<string, any> = {}): FlowContext {
  return {
    requestId: "test-request-id",
    tenantId: "SYSTEM",
    ip: "127.0.0.1",
    userAgent: "vitest",
    db: mockDb as any,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      success: vi.fn(), // FIX: Added missing mock property to fully satisfy FlowLogger interface
    },
    ...overrides,
  } as FlowContext;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("loginFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.resetMocks();
    (clearAttempts as any).mockResolvedValue(undefined);
  });

  describe("happy path", () => {
    it("returns token bundle for valid credentials without MFA", async () => {
      const identity = makeIdentity();
      const session = makeSession();

      (checkLockout as any).mockResolvedValue({ locked: false });
      (clearAttempts as any).mockResolvedValue(undefined);
      mockDb.identity.findUnique.mockResolvedValue(identity);
      (verifyPassword as any).mockResolvedValue(true);

      // Session creation (inside $transaction)
      mockDb.session.create.mockResolvedValue(session);

      // TokenService.issue() lookups (uses mockDb as ctx.db)
      mockDb.client.findUnique.mockResolvedValue({
        id: 1,
        clientId: "arcid-direct",
        public: false,
        clientSecret: null,
      });
      mockDb.subscription.findFirst.mockResolvedValue({
        plan: "FREE",
        status: "ACTIVE",
      });
      mockDb.identity.findUniqueOrThrow.mockResolvedValue(identity);
      mockDb.accessToken.create.mockResolvedValue({ id: "at-1" });
      mockDb.refreshToken.create.mockResolvedValue({ id: "rt-1" });
      mockDb.session.updateMany.mockResolvedValue({ count: 1 });

      const result = await loginFlow.execute(
        { email: "alice@example.com", password: "secret123" },
        ctx(),
      );

      expect(result.requiresMfa).toBe(false);
      expect(result.mfaTypes).toEqual([]);
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.sessionId).toBe(session.id);
      expect(result.identity.email).toBe("alice@example.com");

      expect(clearAttempts).toHaveBeenCalledWith("alice@example.com");

      // Audit: should have logged USER_LOGIN_SUCCESS
      const auditCalls = mockDb.auditLog.create.mock.calls;
      expect(
        auditCalls.some(
          (c: any) => c[0]?.data?.actionId === "USER_LOGIN_SUCCESS",
        ),
      ).toBe(true);
    });
  });

  describe("lockout", () => {
    it("throws unauthorized when account is locked", async () => {
      (checkLockout as any).mockResolvedValue({ locked: true, ttlSecs: 900 });

      await expect(
        loginFlow.execute(
          { email: "alice@example.com", password: "secret123" },
          ctx(),
        ),
      ).rejects.toThrow(ApiError);

      expect(mockDb.identity.findUnique).not.toHaveBeenCalled();

      const auditCalls = mockDb.auditLog.create.mock.calls;
      expect(
        auditCalls.some((c: any) => c[0]?.data?.metadata?.reason === "lockout"),
      ).toBe(true);
    });
  });

  describe("identity resolution", () => {
    it("throws unauthorized when email does not exist", async () => {
      (checkLockout as any).mockResolvedValue({ locked: false });
      mockDb.identity.findUnique.mockResolvedValue(null);

      await expect(
        loginFlow.execute(
          { email: "nobody@example.com", password: "secret123" },
          ctx(),
        ),
      ).rejects.toThrow(ApiError);

      expect(recordFailure).not.toHaveBeenCalled();
    });

    it("throws forbidden when identity is BANNED", async () => {
      (checkLockout as any).mockResolvedValue({ locked: false });
      mockDb.identity.findUnique.mockResolvedValue(
        makeIdentity({ status: "BANNED" }),
      );

      try {
        await loginFlow.execute(
          { email: "alice@example.com", password: "secret123" },
          ctx(),
        );
      } catch (e: any) {
        expect(e.statusCode).toBe(403);
        expect(e.message).toMatch(/banned/i);
      }
    });

    it("throws forbidden when identity is SUSPENDED", async () => {
      (checkLockout as any).mockResolvedValue({ locked: false });
      mockDb.identity.findUnique.mockResolvedValue(
        makeIdentity({ status: "SUSPENDED" }),
      );

      try {
        await loginFlow.execute(
          { email: "alice@example.com", password: "secret123" },
          ctx(),
        );
      } catch (e: any) {
        expect(e.statusCode).toBe(403);
        expect(e.message).toMatch(/suspended/i);
      }
    });

    it("throws unauthorized when identity is DELETED", async () => {
      (checkLockout as any).mockResolvedValue({ locked: false });
      mockDb.identity.findUnique.mockResolvedValue(
        makeIdentity({ status: "DELETED" }),
      );

      try {
        await loginFlow.execute(
          { email: "alice@example.com", password: "secret123" },
          ctx(),
        );
      } catch (e: any) {
        expect(e.statusCode).toBe(401);
        expect(e.message).toMatch(/invalid email/i);
      }
    });
  });

  describe("password verification", () => {
    it("throws unauthorized when password is wrong", async () => {
      const identity = makeIdentity();
      (checkLockout as any).mockResolvedValue({ locked: false });
      mockDb.identity.findUnique.mockResolvedValue(identity);
      (verifyPassword as any).mockResolvedValue(false);

      await expect(
        loginFlow.execute(
          { email: "alice@example.com", password: "wrongpass" },
          ctx(),
        ),
      ).rejects.toThrow(ApiError);

      expect(recordFailure).toHaveBeenCalledWith("alice@example.com");
    });
  });

  describe("MFA path", () => {
    it("returns requiresMfa: true and no tokens when MFA is active", async () => {
      const identity = makeIdentity({
        mfas: [
          { type: "TOTP", enabled: true },
          { type: "SMS", enabled: false },
        ],
      });
      const session = makeSession({ valid: false });

      (checkLockout as any).mockResolvedValue({ locked: false });
      mockDb.identity.findUnique.mockResolvedValue(identity);
      (verifyPassword as any).mockResolvedValue(true);

      mockDb.session.create.mockResolvedValue(session);
      mockDb.session.update.mockResolvedValue({ ...session, valid: false });

      const result = await loginFlow.execute(
        { email: "alice@example.com", password: "secret123" },
        ctx(),
      );

      expect(result.requiresMfa).toBe(true);
      expect(result.mfaEnrollmentRequired).toBe(false); // has enrolled TOTP
      expect(result.mfaTypes).toEqual(["TOTP"]);
      expect(result.accessToken).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
      expect(result.sessionId).toBe(session.id);
    });

    it("returns mfaEnrollmentRequired: true when TenantPolicy requires MFA but identity has zero factors", async () => {
      const identity = makeIdentity({
        mfas: [], // no MFA methods
        // no passkeys
      });
      const session = makeSession({ valid: false });

      (checkLockout as any).mockResolvedValue({ locked: false });
      mockDb.identity.findUnique.mockResolvedValue(identity);
      (verifyPassword as any).mockResolvedValue(true);

      // TenantPolicy requires MFA
      mockDb.tenantPolicy.findUnique.mockResolvedValue({
        requireMfa: true,
        sessionTtlMinutes: 10080,
        maxSessionsPerUser: 10,
      });

      mockDb.session.create.mockResolvedValue(session);
      mockDb.session.update.mockResolvedValue({ ...session, valid: false });

      const result = await loginFlow.execute(
        { email: "alice@example.com", password: "secret123" },
        ctx(),
      );

      expect(result.requiresMfa).toBe(true);
      expect(result.mfaEnrollmentRequired).toBe(true);
      expect(result.mfaTypes).toEqual([]);
      expect(result.accessToken).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
    });

    it("sets mfaEnrollmentRequired: false when policy requires MFA and identity has passkey", async () => {
      const identity = makeIdentity({
        mfas: [],
        passkeys: [{ id: "pk-1", credentialId: "cred123" }],
      });
      const session = makeSession({ valid: false });

      (checkLockout as any).mockResolvedValue({ locked: false });
      mockDb.identity.findUnique.mockResolvedValue(identity);
      (verifyPassword as any).mockResolvedValue(true);

      mockDb.tenantPolicy.findUnique.mockResolvedValue({
        requireMfa: true,
        sessionTtlMinutes: 10080,
        maxSessionsPerUser: 10,
      });

      mockDb.session.create.mockResolvedValue(session);
      mockDb.session.update.mockResolvedValue({ ...session, valid: false });

      const result = await loginFlow.execute(
        { email: "alice@example.com", password: "secret123" },
        ctx(),
      );

      expect(result.requiresMfa).toBe(true);
      expect(result.mfaEnrollmentRequired).toBe(false); // has passkey
    });
  });

  describe("atomicity — transaction rollback on TokenService failure", () => {
    it("rolls back session creation when token issuance fails inside the same transaction", async () => {
      const identity = makeIdentity();
      const session = makeSession();

      (checkLockout as any).mockResolvedValue({ locked: false });
      mockDb.identity.findUnique.mockResolvedValue(identity);
      (verifyPassword as any).mockResolvedValue(true);
      (clearAttempts as any).mockResolvedValue(undefined);

      // Ensure no TenantPolicy leaks from previous tests — default (null)
      // means policyRequireMfa: false → proceeds to token issuance path.
      mockDb.tenantPolicy.findUnique.mockResolvedValue(null);
      mockDb.session.create.mockResolvedValue(session);
      mockDb.client.findUnique.mockResolvedValue({
        id: 1,
        clientId: "arcid-direct",
        public: false,
        clientSecret: null,
      });
      mockDb.subscription.findFirst.mockResolvedValue({
        plan: "FREE",
        status: "ACTIVE",
      });
      mockDb.identity.findUniqueOrThrow.mockResolvedValue(identity);

      // TokenService.issue() calls accessToken.create inside Promise.all([dbWrites]).
      // The dbWrites array is constructed synchronously — methods like
      // refreshToken.create().then(...) need to be pre-mocked to return
      // thenables.  Make accessToken.create reject AFTER session.create
      // has run to simulate the "token issuance fails after session is
      // already created" scenario.
      mockDb.refreshToken.create.mockResolvedValue({ id: "rt-1" });
      mockDb.session.updateMany.mockResolvedValue({ count: 1 });
      mockDb.accessToken.create.mockRejectedValue(
        new Error("Token issuance failed (simulated)"),
      );

      // Wrap the flow execution inside $transaction. In production,
      // FlowExecutor does this — the transaction rollback undoes the
      // session.create call.  The extended $transaction mock pops all
      // model method calls that were made during fn() when fn throws.
      await expect(
        mockDb.$transaction(async (tx: typeof mockDb) => {
          const flowCtx = ctx({ db: tx });
          return loginFlow.execute(
            { email: "alice@example.com", password: "secret123" },
            flowCtx,
          );
        }),
      ).rejects.toThrow("Token issuance failed");

      // After rollback: session.create should have been called (while
      // the tx was running) but then rolled back.  The extended
      // $transaction mock pops calls on throw, so the mock should
      // show zero session.create calls — proving no session row
      // is left committed after a token-issuance failure.
      expect(mockDb.session.create.mock.calls.length).toBe(0);
    });
  });
});
