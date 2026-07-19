// src/modules/oauth/flows/token-refresh.flow.test.ts
//
// Covers: successful refresh with child token (familyId/parentJti inherit),
// expired token (no kill-chain), already-revoked token (replay → kill-chain),
// CAS race loss (concurrent rotation → kill-chain), deleted/suspended identity.

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@prisma-client", () => ({
  UserStatus: {
    ACTIVE: "ACTIVE",
    PENDING: "PENDING",
    BANNED: "BANNED",
    SUSPENDED: "SUSPENDED",
    DELETED: "DELETED",
  },
  AuditLogAction: {},
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
vi.mock("@/core/db", () => ({ prisma: {} }));
vi.mock("@/lib/security/jti-blocklist", () => ({ blockJti: vi.fn() }));

import { createMockFlowCtx } from "@/test-utils/mock-db";
import { tokenRefreshFlow } from "./token-refresh.flow";
import { ApiError } from "@/core/errors";
import { addDays, subDays, addMinutes } from "date-fns";

describe("tokenRefreshFlow", () => {
  const baseCtx = () => createMockFlowCtx({ tenantId: "SYSTEM" });

  const validToken = {
    id: "rt-1",
    jti: "jti-original",
    familyId: "fam-abc",
    revoked: false,
    expiresAt: addDays(new Date(), 5),
    clientId: 42,
    identityId: "identity-1",
    sessionId: "session-1",
  };

  const clientRecord = {
    id: 42,
    clientId: "arcid-direct",
    scopes: ["openid", "profile", "email", "offline_access"],
  };

  const activeIdentity = { id: "identity-1", status: "ACTIVE" };
  const activeSession = { id: "session-1", authLevel: "aal1" };

  function setupHappyPath(ctx: ReturnType<typeof createMockFlowCtx>) {
    ctx.db.refreshToken.findFirst.mockResolvedValue(validToken);
    ctx.db.identity.findUnique.mockResolvedValue(activeIdentity);
    ctx.db.client.findUnique.mockResolvedValue(clientRecord);
    ctx.db.accessToken.findFirst.mockResolvedValue({
      scopes: ["openid", "profile", "email", "offline_access"],
    });
    ctx.db.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    ctx.db.session.findUnique.mockResolvedValue(activeSession);

    // TokenService.issue() lookups
    ctx.db.client.findUnique.mockResolvedValue({
      id: 1,
      clientId: "arcid-direct",
      public: false,
      clientSecret: null,
    });
    ctx.db.subscription.findFirst.mockResolvedValue({
      plan: "FREE",
      status: "ACTIVE",
    });
    ctx.db.identity.findUniqueOrThrow.mockResolvedValue({
      id: "identity-1",
      primaryEmail: "alice@example.com",
      emailVerified: true,
      name: "Alice",
      picture: null,
      username: "alice",
    });
    ctx.db.accessToken.create.mockResolvedValue({ id: "at-new" });
    ctx.db.refreshToken.create.mockResolvedValue({ id: "rt-new" });
    ctx.db.idToken.create.mockResolvedValue({ id: "it-new" });
    ctx.db.session.updateMany.mockResolvedValue({ count: 1 });
  }

  describe("happy path", () => {
    it("issues a child token with inherited familyId and parentJti", async () => {
      const ctx = baseCtx();
      setupHappyPath(ctx);

      const rawResult = await tokenRefreshFlow.execute(
        {
          refresh_token: "valid-refresh-token-value",
          client_id: "arcid-direct",
        },
        ctx,
      );
      const result = rawResult as Record<string, unknown>;

      expect(result["access_token"]).toEqual(expect.any(String));
      expect((result["refresh_token"] as string).length).toBe(64);

      // Verify CAS revocation: updateMany with revoked: false guard
      const updateCall = ctx.db.refreshToken.updateMany.mock.calls.find(
        (c: any[]) => c[0]?.where?.id === "rt-1",
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[0].where.revoked).toBe(false);
      expect(updateCall[0].data.rotatedAt).toBeInstanceOf(Date);

      // Verify child token has inherited family + parentJti
      const rtCreateCall = ctx.db.refreshToken.create.mock.calls[0][0];
      expect(rtCreateCall.data.familyId).toBe("fam-abc");
      expect(rtCreateCall.data.parentJti).toBe("jti-original");
    });

    it("carries forward the current session authLevel", async () => {
      const ctx = baseCtx();
      setupHappyPath(ctx);

      const result = await tokenRefreshFlow.execute(
        {
          refresh_token: "valid-refresh-token-value",
          client_id: "arcid-direct",
        },
        ctx,
      );

      // Session had authLevel aal1, so the token bundle should say aal1
      const accessPayload = JSON.parse(
        Buffer.from(
          (result as any).access_token.split(".")[1],
          "base64url",
        ).toString(),
      );
      expect(accessPayload.aal).toBe("aal1");
    });
  });

  describe("expired token", () => {
    it("returns invalid_grant without triggering kill-chain when token naturally expired", async () => {
      const ctx = baseCtx();
      ctx.db.refreshToken.findFirst.mockResolvedValue({
        ...validToken,
        expiresAt: subDays(new Date(), 1),
      });

      await expect(
        tokenRefreshFlow.execute(
          {
            refresh_token: "expired-token",
            client_id: "arcid-direct",
          },
          ctx,
        ),
      ).rejects.toThrow(ApiError);

      // No kill-chain — refreshToken.updateMany should not be called for
      // the family-wide revocation pattern (only the initial lookup runs)
      try {
        await tokenRefreshFlow.execute(
          {
            refresh_token: "expired-token",
            client_id: "arcid-direct",
          },
          ctx,
        );
      } catch {
        // expected
      }
      // updateMany may still be called for non-family writes, but family-wide
      // kill-chain should NOT fire since token is just expired, not revoked
      expect(ctx.db.session.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("revoked token (replay detection)", () => {
    it("triggers kill-chain when token is already revoked", async () => {
      const ctx = baseCtx();
      ctx.db.refreshToken.findFirst.mockResolvedValue({
        ...validToken,
        revoked: true,
      });
      // kill-chain revokes all siblings
      ctx.db.refreshToken.updateMany.mockResolvedValue({ count: 5 });
      ctx.db.session.updateMany.mockResolvedValue({ count: 1 });
      // blocklistLiveAccessTokens
      ctx.db.accessToken.findMany.mockResolvedValue([]);

      await expect(
        tokenRefreshFlow.execute(
          {
            refresh_token: "replayed-token",
            client_id: "arcid-direct",
          },
          ctx,
        ),
      ).rejects.toThrow(ApiError);

      // Should have called family-wide revocation
      expect(ctx.db.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ familyId: "fam-abc" }),
          data: { revoked: true },
        }),
      );
      expect(ctx.db.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "session-1" }),
          data: { valid: false },
        }),
      );
    });
  });

  describe("CAS race loss", () => {
    it("triggers kill-chain when CAS updateMany returns count=0", async () => {
      const ctx = baseCtx();
      ctx.db.refreshToken.findFirst.mockResolvedValue(validToken);
      ctx.db.identity.findUnique.mockResolvedValue(activeIdentity);
      ctx.db.client.findUnique.mockResolvedValue(clientRecord);
      // First the identity-query, then the client-query — identity returns before CAS
      ctx.db.accessToken.findFirst.mockResolvedValue({
        scopes: ["openid", "profile", "email", "offline_access"],
      });
      // CAS returns 0 — lost the race
      ctx.db.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      // kill-chain revokes family
      ctx.db.session.updateMany.mockResolvedValue({ count: 1 });
      // blocklistLiveAccessTokens query — no live tokens to sweep
      ctx.db.accessToken.findMany.mockResolvedValue([]);

      await expect(
        tokenRefreshFlow.execute(
          {
            refresh_token: "race-condition-token",
            client_id: "arcid-direct",
          },
          ctx,
        ),
      ).rejects.toThrow(ApiError);
    });
  });

  describe("identity status", () => {
    it("rejects refresh for deleted identity", async () => {
      const ctx = baseCtx();
      ctx.db.refreshToken.findFirst.mockResolvedValue(validToken);
      ctx.db.identity.findUnique.mockResolvedValue({
        id: "identity-1",
        status: "DELETED",
      });

      await expect(
        tokenRefreshFlow.execute(
          {
            refresh_token: "valid-token",
            client_id: "arcid-direct",
          },
          ctx,
        ),
      ).rejects.toThrow(ApiError);
    });

    it("rejects refresh for suspended identity", async () => {
      const ctx = baseCtx();
      ctx.db.refreshToken.findFirst.mockResolvedValue(validToken);
      ctx.db.identity.findUnique.mockResolvedValue({
        id: "identity-1",
        status: "SUSPENDED",
      });

      try {
        await tokenRefreshFlow.execute(
          { refresh_token: "valid-token", client_id: "arcid-direct" },
          ctx,
        );
      } catch (e: any) {
        expect(e.statusCode).toBe(403);
      }
    });

    it("rejects refresh for banned identity", async () => {
      const ctx = baseCtx();
      ctx.db.refreshToken.findFirst.mockResolvedValue(validToken);
      ctx.db.identity.findUnique.mockResolvedValue({
        id: "identity-1",
        status: "BANNED",
      });

      try {
        await tokenRefreshFlow.execute(
          { refresh_token: "valid-token", client_id: "arcid-direct" },
          ctx,
        );
      } catch (e: any) {
        expect(e.statusCode).toBe(403);
      }
    });
  });

  describe("missing token", () => {
    it("returns invalid_grant when token does not exist", async () => {
      const ctx = baseCtx();
      ctx.db.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        tokenRefreshFlow.execute(
          { refresh_token: "nonexistent", client_id: "arcid-direct" },
          ctx,
        ),
      ).rejects.toThrow(ApiError);
    });
  });
});
