// src/modules/auth/flows/passkey-authenticate.flow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));

vi.mock("@prisma-client", () => ({
  UserStatus: {},
  AuditLogAction: {},
  MfaType: {},
  VcFormat: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));
vi.mock("@/api/plugins/jwt.plugin", () => ({ resolvePemContent: vi.fn(() => "") }));
vi.mock("@/core/db", () => ({ prisma: {} }));

const mockVerifyAuthentication = vi.fn();
const mockSessionCreate = vi.fn();
const mockTokenIssue = vi.fn();
vi.mock("../services/passkey.service", () => ({
  PasskeyService: vi.fn().mockImplementation(function () {
    return { verifyAuthentication: mockVerifyAuthentication };
  }),
}));
vi.mock("../services/session.service", () => ({
  SessionService: vi.fn().mockImplementation(function () {
    return { create: mockSessionCreate };
  }),
}));
vi.mock("@/modules/oauth/services/token.service", () => ({
  TokenService: vi.fn().mockImplementation(function () {
    return { issue: mockTokenIssue };
  }),
}));
vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/lib/challenge-store", () => ({
  consumeChallenge: vi.fn(),
}));

import { passkeyAuthenticateFlow } from "./passkey-authenticate.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

describe("passkeyAuthenticateFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuthentication.mockReset().mockResolvedValue({ verified: true });
    mockSessionCreate.mockReset().mockResolvedValue({ session: { id: "session-1" } });
    mockTokenIssue.mockReset().mockResolvedValue({ accessToken: "at-1", refreshToken: "rt-1", idToken: null, expiresIn: 3600 });
  });

  it("authenticates with valid passkey assertion", async () => {
    const { consumeChallenge } = await import("@/lib/challenge-store");
    (consumeChallenge as any).mockResolvedValue({
      challengeId: "challenge-uuid-1111",
      challenge: "base64-challenge-bytes",
    });

    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.passkey.findUnique.mockResolvedValue({ identityId: "identity-1", id: "pk-1" });

    const result = await passkeyAuthenticateFlow.execute(
      { response: { id: "credential-id-123" }, challengeId: "challenge-uuid-1111" },
      ctx,
    );

    expect(result).toMatchObject({ sessionId: "session-1", identityId: "identity-1", accessToken: "at-1" });
  });

  it("throws badRequest when response.id is missing", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });

    await expect(
      passkeyAuthenticateFlow.execute({ response: {}, challengeId: "uuid" } as any, ctx),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws unauthorized when credential is not registered", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.passkey.findUnique.mockResolvedValue(null);

    await expect(
      passkeyAuthenticateFlow.execute({ response: { id: "unknown-cred" }, challengeId: "uuid" }, ctx),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws badRequest when challenge is expired or missing", async () => {
    const { consumeChallenge } = await import("@/lib/challenge-store");
    (consumeChallenge as any).mockResolvedValue(null);

    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.passkey.findUnique.mockResolvedValue({ identityId: "identity-1", id: "pk-1" });

    await expect(
      passkeyAuthenticateFlow.execute({ response: { id: "credential-id-123" }, challengeId: "uuid" }, ctx),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws badRequest when challengeId mismatches", async () => {
    const { consumeChallenge } = await import("@/lib/challenge-store");
    (consumeChallenge as any).mockResolvedValue({
      challengeId: "expected-uuid",
      challenge: "base64-challenge-bytes",
    });

    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.passkey.findUnique.mockResolvedValue({ identityId: "identity-1", id: "pk-1" });

    await expect(
      passkeyAuthenticateFlow.execute({ response: { id: "credential-id-123" }, challengeId: "wrong-uuid" }, ctx),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws unauthorized when assertion verification fails", async () => {
    const { consumeChallenge } = await import("@/lib/challenge-store");
    (consumeChallenge as any).mockResolvedValue({
      challengeId: "challenge-uuid-1111",
      challenge: "base64-challenge-bytes",
    });

    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
    ctx.db.passkey.findUnique.mockResolvedValue({ identityId: "identity-1", id: "pk-1" });
    mockVerifyAuthentication.mockResolvedValue({ verified: false });

    await expect(
      passkeyAuthenticateFlow.execute({ response: { id: "credential-id-123" }, challengeId: "challenge-uuid-1111" }, ctx),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
