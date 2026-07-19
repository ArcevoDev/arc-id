import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/security/jti-blocklist", () => ({
  blockJti: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { logoutFlow } from "./logout.flow";
import { blockJti } from "@/lib/security/jti-blocklist";
import { createMockFlowCtx } from "@/test-utils/mock-db";

const SESSION_ID = "s".repeat(40);

function setupSession(ctx: ReturnType<typeof createMockFlowCtx>) {
  ctx.db.session.findFirst.mockResolvedValue({
    id: SESSION_ID,
    identityId: "identity-1",
    refreshTokenId: "rt-1",
  });
  ctx.db.$transaction.mockImplementation(async (fn: any) => fn(ctx.db));
}

beforeEach(() => {
  vi.mocked(blockJti).mockClear();
});

describe("logoutFlow — closes the access-token-never-blocklisted gap", () => {
  it("REGRESSION: calls blockJti with the access token's jti and remaining TTL when accessJti/accessTokenExp are provided", async () => {
    const ctx = createMockFlowCtx();
    setupSession(ctx);

    const expInFutureSec = Math.floor(Date.now() / 1000) + 600; // 10 min out

    await logoutFlow.execute(
      {
        sessionId: SESSION_ID,
        accessJti: "jti-123",
        accessTokenExp: expInFutureSec,
      },
      ctx,
    );

    expect(blockJti).toHaveBeenCalledTimes(1);
    const [calledJti, calledTtl] = (blockJti as any).mock.calls[0];
    expect(calledJti).toBe("jti-123");
    expect(calledTtl).toBeGreaterThan(0);
    expect(calledTtl).toBeLessThanOrEqual(600);
  });

  it("REGRESSION: writes revokedJti with the required expiresAt field (would previously throw / silently no-op)", async () => {
    const ctx = createMockFlowCtx();
    setupSession(ctx);

    const expSec = Math.floor(Date.now() / 1000) + 300;
    await logoutFlow.execute(
      { sessionId: SESSION_ID, accessJti: "jti-abc", accessTokenExp: expSec },
      ctx,
    );

    expect(ctx.db.revokedJti.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jti: "jti-abc" },
        create: expect.objectContaining({
          jti: "jti-abc",
          expiresAt: expect.any(Date),
        }),
      }),
    );
  });

  it("does not blocklist anything when accessJti/accessTokenExp are absent (e.g. malformed JWT payload) — fails safe, doesn't throw", async () => {
    const ctx = createMockFlowCtx();
    setupSession(ctx);

    await expect(
      logoutFlow.execute({ sessionId: SESSION_ID }, ctx),
    ).resolves.toEqual({});

    expect(blockJti).not.toHaveBeenCalled();
    expect(ctx.db.revokedJti.upsert).not.toHaveBeenCalled();
  });

  it("still revokes the session and refresh token regardless of access-token blocklisting", async () => {
    const ctx = createMockFlowCtx();
    setupSession(ctx);

    await logoutFlow.execute({ sessionId: SESSION_ID }, ctx);

    expect(ctx.db.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: { valid: false },
      }),
    );
    expect(ctx.db.refreshToken.updateMany).toHaveBeenCalled();
  });
});
