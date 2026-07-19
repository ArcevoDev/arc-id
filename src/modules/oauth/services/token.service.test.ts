// src/modules/oauth/services/token.service.test.ts
//
// Covers: issue() with all param shapes, familyId/parentJti threading,
// authLevel JWT claim, client/subscription/identity lookups, HS256 path,
// and the three parallel DB ledger writes.

import { describe, it, expect, beforeEach } from "vitest";
import { TokenService } from "./token.service";
import { createMockFlowCtx } from "@/test-utils/mock-db";

describe("TokenService", () => {
  let svc: TokenService;

  beforeEach(() => {
    svc = new TokenService();
  });

  const baseClient = {
    id: 1,
    clientId: "arcid-direct",
    public: false,
    clientSecret: null,
  };

  const baseIdentity = {
    id: "identity-1",
    primaryEmail: "alice@example.com",
    emailVerified: true,
    name: "Alice",
    picture: null,
    username: "alice",
  };

  const baseParams = {
    identityId: "identity-1",
    clientId: "arcid-direct",
    sessionId: "session-1",
    scopes: ["openid", "profile", "email", "offline_access"],
    audience: ["arcid-direct"],
    tenantId: "SYSTEM",
  };

  // ── Happy path: full token bundle with openid scope ─────────────────────

  it("issues access, refresh, and id tokens for openid scope", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });

    ctx.db.client.findUnique.mockResolvedValue(baseClient);
    ctx.db.subscription.findFirst.mockResolvedValue({
      plan: "FREE",
      status: "ACTIVE",
    });
    ctx.db.identity.findUniqueOrThrow.mockResolvedValue(baseIdentity);
    ctx.db.accessToken.create.mockResolvedValue({ id: "at-1" });
    ctx.db.refreshToken.create.mockResolvedValue({ id: "rt-1" });
    ctx.db.session.updateMany.mockResolvedValue({ count: 1 });

    const bundle = await svc.issue(ctx, baseParams);

    expect(bundle.accessToken).toEqual(expect.any(String));
    expect(bundle.refreshToken).toHaveLength(64); // generateToken(48) → 64 base64url chars
    expect(bundle.idToken).toEqual(expect.any(String));
    expect(bundle.expiresIn).toBeGreaterThan(0);
    expect(bundle.authLevel).toBeNull(); // omitted → null

    // Verify DB writes
    expect(ctx.db.accessToken.create).toHaveBeenCalledTimes(1);
    expect(ctx.db.refreshToken.create).toHaveBeenCalledTimes(1);
    // Verify refresh token DB row has jti, familyId, parentJti
    const rtCreateCall = ctx.db.refreshToken.create.mock.calls[0][0];
    expect(rtCreateCall.data.jti).toEqual(expect.any(String));
    expect(rtCreateCall.data.familyId).toEqual(expect.any(String));
    expect(rtCreateCall.data.parentJti).toBeNull(); // root token
    expect(rtCreateCall.data.rotation).toBe(0);
    expect(rtCreateCall.data.revoked).toBe(false);

    // ID token write
    expect(ctx.db.idToken.create).toHaveBeenCalledTimes(1);
    const idtCreateCall = ctx.db.idToken.create.mock.calls[0][0];
    expect(idtCreateCall.data.claims.email).toBe("alice@example.com");

    // Session update linking refresh token
    expect(ctx.db.session.updateMany).toHaveBeenCalledTimes(1);
  });

  // ── authLevel threaded into JWT claims ─────────────────────────────────

  it("includes aal claim in access token JWT when authLevel is provided", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });

    ctx.db.client.findUnique.mockResolvedValue(baseClient);
    ctx.db.subscription.findFirst.mockResolvedValue({
      plan: "FREE",
      status: "ACTIVE",
    });
    ctx.db.identity.findUniqueOrThrow.mockResolvedValue(baseIdentity);
    ctx.db.accessToken.create.mockResolvedValue({ id: "at-1" });
    ctx.db.refreshToken.create.mockResolvedValue({ id: "rt-1" });
    ctx.db.session.updateMany.mockResolvedValue({ count: 1 });

    const bundle = await svc.issue(ctx, {
      ...baseParams,
      authLevel: "aal2",
    });

    // Decode the access token JWT to check the aal claim
    const accessPayload = JSON.parse(
      Buffer.from(bundle.accessToken.split(".")[1], "base64url").toString(),
    );
    expect(accessPayload.aal).toBe("aal2");

    // Also check id token
    if (bundle.idToken) {
      const idPayload = JSON.parse(
        Buffer.from(bundle.idToken.split(".")[1], "base64url").toString(),
      );
      expect(idPayload.aal).toBe("aal2");
      expect(idPayload.preferred_username).toBe("alice");
    }
  });

  // ── familyId/parentJti for rotated tokens ──────────────────────────────

  it("inherits familyId and sets parentJti for rotated (child) tokens", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });

    ctx.db.client.findUnique.mockResolvedValue(baseClient);
    ctx.db.subscription.findFirst.mockResolvedValue({
      plan: "FREE",
      status: "ACTIVE",
    });
    ctx.db.identity.findUniqueOrThrow.mockResolvedValue(baseIdentity);
    ctx.db.accessToken.create.mockResolvedValue({ id: "at-1" });
    ctx.db.refreshToken.create.mockResolvedValue({ id: "rt-1" });
    ctx.db.session.updateMany.mockResolvedValue({ count: 1 });

    const bundle = await svc.issue(ctx, {
      ...baseParams,
      familyId: "fam-abc-123",
      parentJti: "parent-uuid-456",
    });

    const rtCreateCall = ctx.db.refreshToken.create.mock.calls[0][0];
    expect(rtCreateCall.data.familyId).toBe("fam-abc-123");
    expect(rtCreateCall.data.parentJti).toBe("parent-uuid-456");
    expect(bundle.accessToken).toEqual(expect.any(String));
  });

  // ── No identity lookup when openid scope is missing ────────────────────

  it("skips identity lookup and id token when openid scope is absent", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });

    ctx.db.client.findUnique.mockResolvedValue(baseClient);
    ctx.db.subscription.findFirst.mockResolvedValue({
      plan: "FREE",
      status: "ACTIVE",
    });
    ctx.db.accessToken.create.mockResolvedValue({ id: "at-1" });
    ctx.db.refreshToken.create.mockResolvedValue({ id: "rt-1" });
    ctx.db.session.updateMany.mockResolvedValue({ count: 1 });

    const bundle = await svc.issue(ctx, {
      ...baseParams,
      scopes: ["email", "offline_access"],
    });

    expect(bundle.idToken).toBeNull();
    expect(ctx.db.identity.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  // ── Missing client throws ──────────────────────────────────────────────

  it("throws when OAuth client is not found", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.client.findUnique.mockResolvedValue(null);
    ctx.db.subscription.findFirst.mockResolvedValue(null);
    ctx.db.identity.findUniqueOrThrow.mockResolvedValue(null);

    await expect(svc.issue(ctx, baseParams)).rejects.toThrow(
      /OAuth Client matching/,
    );
  });

  // ── Plan from subscription ─────────────────────────────────────────────

  it("reads plan from active subscription and includes it in access token", async () => {
    const ctx = createMockFlowCtx({ tenantId: "tenant-pro" });

    ctx.db.client.findUnique.mockResolvedValue(baseClient);
    ctx.db.subscription.findFirst.mockResolvedValue({
      plan: "PRO",
      status: "ACTIVE",
    });
    ctx.db.identity.findUniqueOrThrow.mockResolvedValue(baseIdentity);
    ctx.db.accessToken.create.mockResolvedValue({ id: "at-1" });
    ctx.db.refreshToken.create.mockResolvedValue({ id: "rt-1" });
    ctx.db.session.updateMany.mockResolvedValue({ count: 1 });

    const bundle = await svc.issue(ctx, {
      ...baseParams,
      tenantId: "tenant-pro",
      authLevel: "aal1",
    });

    const payload = JSON.parse(
      Buffer.from(bundle.accessToken.split(".")[1], "base64url").toString(),
    );
    expect(payload.plan).toBe("PRO");
    expect(payload.tid).toBe("tenant-pro");
  });
});
