// src/modules/auth/services/session.service.test.ts
//
// Covers: create (default TTL, policy TTL, maxSessionsPerUser eviction),
// elevate, promoteToAal2, validate (valid, expired, not-found).

import { describe, it, expect, beforeEach, vi } from "vitest";

// Must mock @/core/db before importing SessionService — SessionService imports
// DbClient which resolves to @/core/db → prisma.ts which builds a real PrismaClient
// with WASM adapter.  This mock short-circuits that chain.
vi.mock("@/core/db", () => ({}));

import { SessionService } from "./session.service";
import { createMockDb } from "@/test-utils/mock-db";
import { addDays, addMinutes } from "date-fns";

// ── Helper: create a fake session object matching the create() return shape ──
function fakeSession(overrides: Record<string, any> = {}) {
  const expiry = addMinutes(new Date(), 10080);
  return {
    id: "tok-" + "x".repeat(60),
    identityId: "identity-1",
    localAccountId: null,
    ip: "127.0.0.1",
    userAgent: "test-agent",
    valid: true,
    expiresAt: expiry,
    authLevel: "aal1",
    ...overrides,
  };
}

describe("SessionService", () => {
  let db: ReturnType<typeof createMockDb>;
  let svc: SessionService;

  beforeEach(() => {
    db = createMockDb();
    svc = new SessionService(db);
  });

  describe("create", () => {
    it("creates a session with defaults", async () => {
      const s = fakeSession();
      db.session.create.mockResolvedValue(s);

      const { session } = await svc.create({
        identityId: "identity-1",
        ip: "127.0.0.1",
        userAgent: "test-agent",
      });

      expect(session.authLevel).toBe("aal1");
      expect(session.valid).toBe(true);
      expect(session.identityId).toBe("identity-1");

      const createCall = db.session.create.mock.calls[0][0];
      expect(createCall.data.authLevel).toBe("aal1");
      expect(createCall.data.valid).toBe(true);
      expect(createCall.data.identityId).toBe("identity-1");

      // Default TTL is schema default 10080 minutes (~7 days)
      expect(createCall.data.expiresAt.getTime()).toBeGreaterThan(
        Date.now() + 10000 * 60 * 1000,
      );
    });

    it("uses sessionTtlMinutes for expiration when provided", async () => {
      const s = fakeSession({ expiresAt: addMinutes(new Date(), 60) });
      db.session.create.mockResolvedValue(s);

      await svc.create({
        identityId: "identity-1",
        ip: "127.0.0.1",
        userAgent: "test-agent",
        sessionTtlMinutes: 60,
      });

      const createCall = db.session.create.mock.calls[0][0];
      expect(createCall.data.expiresAt).toBeDefined();
      // 60 minutes from now
      const diffMs = createCall.data.expiresAt.getTime() - Date.now();
      // Allow 5 seconds clock skew
      expect(diffMs).toBeGreaterThan(55 * 60 * 1000);
      expect(diffMs).toBeLessThan(65 * 60 * 1000);
    });

    it("accepts explicit authLevel aal2 from passkey/MFA flows", async () => {
      const s = fakeSession({
        id: "tok-" + "y".repeat(60),
        userAgent: "passkey-test",
        authLevel: "aal2",
      });
      db.session.create.mockResolvedValue(s);

      const { session } = await svc.create({
        identityId: "identity-1",
        ip: "127.0.0.1",
        userAgent: "passkey-test",
        authLevel: "aal2",
      });

      expect(session.authLevel).toBe("aal2");
      expect(db.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ authLevel: "aal2" }),
        }),
      );
    });

    describe("maxSessionsPerUser eviction", () => {
      it("evicts oldest sessions when at/over cap and creates the new one", async () => {
        const id = "identity-evict";
        db.session.count.mockResolvedValue(10); // at cap
        db.session.findMany.mockResolvedValue([
          { id: "oldest-1" },
          { id: "oldest-2" },
        ]);

        const s = fakeSession({ identityId: id });
        db.session.create.mockResolvedValue(s);

        await svc.create({
          identityId: id,
          ip: "127.0.0.1",
          userAgent: "test-agent",
          maxSessionsPerUser: 10,
        });

        // Should have evicted the oldest (cap - 1 + 1 = 1 by default, but
        // count=10 → excess=1, so it evicts 1).
        expect(db.session.updateMany).toHaveBeenCalledWith({
          where: { id: { in: ["oldest-1"] } },
          data: { valid: false },
        });
        expect(db.session.create).toHaveBeenCalledTimes(1);
      });

      it("evicts exactly (activeCount - max + 1) sessions", async () => {
        const id = "identity-evict-many";
        db.session.count.mockResolvedValue(15); // 5 over cap of 10
        db.session.findMany.mockResolvedValue([
          { id: "oldest-1" },
          { id: "oldest-2" },
          { id: "oldest-3" },
          { id: "oldest-4" },
          { id: "oldest-5" },
          { id: "oldest-6" },
        ]);

        const s = fakeSession({ identityId: id });
        db.session.create.mockResolvedValue(s);

        await svc.create({
          identityId: id,
          ip: "127.0.0.1",
          userAgent: "test-agent",
          maxSessionsPerUser: 10,
        });

        // excess = 15 - 10 + 1 = 6
        expect(db.session.updateMany).toHaveBeenCalledWith({
          where: {
            id: {
              in: [
                "oldest-1",
                "oldest-2",
                "oldest-3",
                "oldest-4",
                "oldest-5",
                "oldest-6",
              ],
            },
          },
          data: { valid: false },
        });
      });

      it("does not evict when under cap", async () => {
        const id = "identity-under-cap";
        db.session.count.mockResolvedValue(5); // under cap of 10

        const s = fakeSession({ identityId: id });
        db.session.create.mockResolvedValue(s);

        await svc.create({
          identityId: id,
          ip: "127.0.0.1",
          userAgent: "test-agent",
          maxSessionsPerUser: 10,
        });

        expect(db.session.updateMany).not.toHaveBeenCalled();
        expect(db.session.create).toHaveBeenCalledTimes(1);
      });

      it("does not evict when maxSessionsPerUser is not provided", async () => {
        const s = fakeSession();
        db.session.create.mockResolvedValue(s);

        await svc.create({
          identityId: "identity-no-cap",
          ip: "127.0.0.1",
          userAgent: "test-agent",
        });

        expect(db.session.count).not.toHaveBeenCalled();
        expect(db.session.findMany).not.toHaveBeenCalled();
        expect(db.session.updateMany).not.toHaveBeenCalled();
      });
    });
  });

  describe("elevate", () => {
    it("sets authLevel=aal2 and stamps elevatedAt", async () => {
      db.session.update.mockResolvedValue({ id: "sess-1" });

      await svc.elevate("sess-1");

      const updateData = db.session.update.mock.calls[0][0];
      expect(updateData.where).toEqual({ id: "sess-1" });
      expect(updateData.data.authLevel).toBe("aal2");
      expect(updateData.data.elevatedAt).toBeInstanceOf(Date);
    });
  });

  describe("promoteToAal2", () => {
    it("sets authLevel=aal2 without touching elevatedAt", async () => {
      db.session.update.mockResolvedValue({ id: "sess-1" });

      await svc.promoteToAal2("sess-1");

      expect(db.session.update).toHaveBeenCalledWith({
        where: { id: "sess-1" },
        data: { authLevel: "aal2" },
      });
    });
  });

  describe("validate", () => {
    it("returns session when token is valid and unexpired", async () => {
      const session = {
        id: "valid-token",
        identityId: "identity-1",
        valid: true,
        expiresAt: addDays(new Date(), 7),
        identity: { id: "identity-1", primaryEmail: "alice@example.com" },
      };
      db.session.findFirst.mockResolvedValue(session);

      const result = await svc.validate("valid-token");
      expect(result).toEqual(session);
      expect(db.session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "valid-token",
            valid: true,
            expiresAt: { gt: expect.any(Date) },
          }),
        }),
      );
    });

    it("returns null when session is expired", async () => {
      db.session.findFirst.mockResolvedValue(null);

      const result = await svc.validate("expired-token");
      expect(result).toBeNull();
    });

    it("returns null when session does not exist", async () => {
      db.session.findFirst.mockResolvedValue(null);

      const result = await svc.validate("nonexistent");
      expect(result).toBeNull();
    });
  });
});
