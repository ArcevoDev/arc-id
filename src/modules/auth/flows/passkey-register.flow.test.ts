// src/modules/auth/flows/passkey-register.flow.test.ts
//
// Covers: TenantPolicy.allowPasskeys enforcement (blocked when false,
// allowed when true, allowed when null), plus basic flow guards
// (unauthenticated rejection, successful registration path).

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockVerifyRegistration = vi.fn().mockResolvedValue({ verified: true });

vi.mock("@/lib/challenge-store", () => ({
  consumeChallenge: vi.fn(),
}));
vi.mock("../services/passkey.service", () => ({
  PasskeyService: vi.fn(function () {
    return { verifyRegistration: mockVerifyRegistration };
  }),
}));
vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { passkeyRegisterFlow } from "./passkey-register.flow";
import { createMockDb, createMockFlowCtx } from "@/test-utils/mock-db";
import { consumeChallenge } from "@/lib/challenge-store";
import { ApiError } from "@/core/errors";

// ── Default mocks ─────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  (consumeChallenge as any).mockResolvedValue({
    challenge: "server-challenge-hex",
    challengeId: "550e8400-e29b-41d4-a716-446655440000",
  });
  mockVerifyRegistration.mockResolvedValue({ verified: true });
});

function ctx(
  db: ReturnType<typeof createMockDb>,
  overrides: Record<string, any> = {},
) {
  return createMockFlowCtx({ db, identityId: "identity-1", ...overrides });
}

const validInput = {
  response: { id: "credential-id-1", response: {} },
  challengeId: "550e8400-e29b-41d4-a716-446655440000",
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("passkeyRegisterFlow", () => {
  describe("TenantPolicy.allowPasskeys enforcement", () => {
    it("rejects registration when allowPasskeys is false", async () => {
      const db = createMockDb();
      db.tenantPolicy.findUnique.mockResolvedValue({ allowPasskeys: false });

      try {
        await passkeyRegisterFlow.execute(validInput, ctx(db));
        expect("should have thrown").toBe("never reached");
      } catch (e: any) {
        expect(e).toBeInstanceOf(ApiError);
        expect(e.statusCode).toBe(403);
        expect(e.code).toBe("FORBIDDEN");
        expect(e.message).toMatch(/passkey.*disabled/i);
      }
    });

    it("allows registration when allowPasskeys is true", async () => {
      const db = createMockDb();
      db.tenantPolicy.findUnique.mockResolvedValue({ allowPasskeys: true });

      const result = await passkeyRegisterFlow.execute(validInput, ctx(db));

      expect(result.verified).toBe(true);
      expect(mockVerifyRegistration).toHaveBeenCalledWith(
        "identity-1",
        validInput.response,
        "server-challenge-hex",
      );
    });

    it("allows registration when no TenantPolicy row exists (null fallback)", async () => {
      const db = createMockDb();
      db.tenantPolicy.findUnique.mockResolvedValue(null);

      const result = await passkeyRegisterFlow.execute(validInput, ctx(db));

      expect(result.verified).toBe(true);
    });

    it("allows registration when ctx.tenantId is undefined", async () => {
      const db = createMockDb();

      const result = await passkeyRegisterFlow.execute(
        validInput,
        ctx(db, { tenantId: undefined }),
      );

      expect(result.verified).toBe(true);
      // tenantPolicy.findUnique should NOT have been called
      expect(db.tenantPolicy.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("basic flow guards", () => {
    it("rejects unauthenticated requests", async () => {
      const db = createMockDb();

      try {
        await passkeyRegisterFlow.execute(
          validInput,
          ctx(db, { identityId: undefined }),
        );
        expect("should have thrown").toBe("never reached");
      } catch (e: any) {
        expect(e).toBeInstanceOf(ApiError);
        expect(e.statusCode).toBe(401);
      }
    });
  });
});
