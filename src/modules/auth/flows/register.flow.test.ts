// src/modules/auth/flows/register.flow.test.ts
//
// Covers: successful registration, duplicate-rejection, and TenantPolicy
// allowedEmailDomains enforcement (matching domain, non-matching domain,
// no-restriction default).

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
// Must be hoisted before imports so they are in effect when the modules load.
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
vi.mock("@/lib/notifications/notification.service", () => ({
  notificationService: { sendEmailVerification: vi.fn() },
}));
vi.mock("@/lib/webhooks/webhook-dispatcher", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/password.service", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-argon2"),
}));
vi.mock("@/lib/security/password-rules", () => ({
  enforceSystemPasswordRules: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/email-token.service", () => {
  const mockIssue = vi.fn().mockResolvedValue("verify-token-abc");
  return {
    EmailTokenService: vi.fn(function () {
      return { issue: mockIssue };
    }),
  };
});
vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("../presenters/identity.presenter", () => ({
  presentIdentity: vi.fn((identity: any) => ({
    id: identity.id,
    email: identity.primaryEmail,
    name: identity.name,
    status: identity.status,
  })),
}));

import { registerFlow } from "./register.flow";
import { createMockDb, createMockFlowCtx } from "@/test-utils/mock-db";
import { ApiError } from "@/core/errors";

// ── Factory helpers ────────────────────────────────────────────────────────────

function makeIdentity(overrides: Record<string, any> = {}) {
  return {
    id: "identity-new",
    primaryEmail: "alice@example.com",
    name: "Alice",
    username: null,
    picture: null,
    status: "PENDING",
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function ctx(db: ReturnType<typeof createMockDb>) {
  return createMockFlowCtx({ db });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("registerFlow", () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    // Default: no duplicate email
    db.identity.count.mockResolvedValue(0);
    // Default: MEMBER role exists (needed inside $transaction)
    db.role.findFirst.mockResolvedValue({
      id: "role-member",
      name: "MEMBER",
    });
    db.tenantMembership.create.mockResolvedValue({ id: "membership-1" });
  });

  describe("allowedEmailDomains enforcement", () => {
    it("allows registration when policy has matching domain", async () => {
      db.tenantPolicy.findUnique.mockResolvedValue({
        allowedEmailDomains: ["example.com", "trusted.org"],
      });
      db.identity.create.mockResolvedValue(
        makeIdentity({ primaryEmail: "bob@trusted.org" }),
      );

      const result = await registerFlow.execute(
        { email: "bob@trusted.org", password: "secret123", name: "Bob" },
        ctx(db),
      );

      expect(result.identity).toBeDefined();
      expect(result.identity.email).toBe("bob@trusted.org");
    });

    it("rejects registration when email domain is not in allowed list", async () => {
      db.tenantPolicy.findUnique.mockResolvedValue({
        allowedEmailDomains: ["example.com"],
      });

      try {
        await registerFlow.execute(
          { email: "attacker@evil.com", password: "secret123", name: "Evil" },
          ctx(db),
        );
        expect("should have thrown").toBe("never reached");
      } catch (e: any) {
        expect(e).toBeInstanceOf(ApiError);
        expect(e.statusCode).toBe(400);
        expect(e.code).toBe("EMAIL_DOMAIN_NOT_ALLOWED");
        expect(e.message).toMatch(/domain.*not allowed/i);
      }
    });

    it("allows registration when allowedEmailDomains is empty array (no restriction)", async () => {
      db.tenantPolicy.findUnique.mockResolvedValue({
        allowedEmailDomains: [],
      });
      db.identity.create.mockResolvedValue(
        makeIdentity({ primaryEmail: "anyone@random.org" }),
      );

      const result = await registerFlow.execute(
        {
          email: "anyone@random.org",
          password: "secret123",
          name: "Anyone",
        },
        ctx(db),
      );

      expect(result.identity.email).toBe("anyone@random.org");
    });

    it("allows registration when no TenantPolicy row exists (null fallback)", async () => {
      db.tenantPolicy.findUnique.mockResolvedValue(null);
      db.identity.create.mockResolvedValue(
        makeIdentity({ primaryEmail: "nopolicy@example.com" }),
      );

      const result = await registerFlow.execute(
        {
          email: "nopolicy@example.com",
          password: "secret123",
          name: "NoPolicy",
        },
        ctx(db),
      );

      expect(result.identity.email).toBe("nopolicy@example.com");
    });

    it("rejects registration when email has no domain part", async () => {
      db.tenantPolicy.findUnique.mockResolvedValue({
        allowedEmailDomains: ["example.com"],
      });

      try {
        await registerFlow.execute(
          { email: "bademail", password: "secret123", name: "Bad" },
          ctx(db),
        );
        expect("should have thrown").toBe("never reached");
      } catch (e: any) {
        expect(e).toBeInstanceOf(ApiError);
        expect(e.statusCode).toBe(400);
        expect(e.code).toBe("EMAIL_DOMAIN_NOT_ALLOWED");
      }
    });
  });

  describe("existing registration logic", () => {
    it("rejects duplicate email", async () => {
      db.identity.count.mockResolvedValue(1);

      try {
        await registerFlow.execute(
          { email: "alice@example.com", password: "secret123" },
          ctx(db),
        );
        expect("should have thrown").toBe("never reached");
      } catch (e: any) {
        expect(e).toBeInstanceOf(ApiError);
        expect(e.statusCode).toBe(409);
        expect(e.code).toBe("CONFLICT");
      }
    });
  });
});
