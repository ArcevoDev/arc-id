// src/modules/oauth/flows/token-exchange.flow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTokenServiceIssue } = vi.hoisted(() => ({
  mockTokenServiceIssue: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));

vi.mock("@prisma-client", () => ({
  Fido2CredentialType: {},
  UserStatus: {},
  VcFormat: {},
  StatusPurpose: {},
  AuditLogAction: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

const mockFindByClientIdOrThrow = vi.fn();
vi.mock("@/modules/oauth/repositories/client.repository", () => ({
  ClientRepository: vi.fn().mockImplementation(function () {
    return { findByClientIdOrThrow: mockFindByClientIdOrThrow };
  }),
}));

vi.mock("@/modules/oauth/services/token.service", () => ({
  TokenService: vi.fn().mockImplementation(function () {
    return { issue: mockTokenServiceIssue };
  }),
}));

vi.mock("@/modules/audit/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/security/jti-blocklist", () => ({ blockJti: vi.fn() }));

vi.mock("argon2", () => ({
  default: { verify: vi.fn().mockResolvedValue(true) },
  verify: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/pkce.service", () => ({
  verifyPkce: vi.fn().mockReturnValue(true),
}));

import { tokenExchangeFlow } from "./token-exchange.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";
import { addMinutes } from "date-fns";

const mockTokenBundle = {
  accessToken: "at-jwt-123",
  refreshToken: "rt-64byteshex",
  idToken: null,
  expiresIn: 3600,
};

describe("tokenExchangeFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByClientIdOrThrow.mockReset().mockResolvedValue({
      id: 42,
      clientId: "test-client",
      scopes: ["openid", "profile", "email"],
      clientSecret: null, // public client
      public: true,
    });
    mockTokenServiceIssue.mockReset().mockResolvedValue(mockTokenBundle);
  });

  describe("authorization_code grant", () => {
    const baseAuthCode = {
      id: 1,
      code: "valid-code",
      consumed: false,
      expiresAt: addMinutes(new Date(), 5),
      clientId: 42,
      identityId: "identity-1",
      scopes: ["openid", "profile", "email"],
      nonce: null,
      state: "xyz-state",
      codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      codeChallengeMethod: "S256",
      redirectUri: "https://app.example.com/cb",
      client: {
        clientId: "test-client",
        public: true,
        clientSecret: null,
        requirePkce: true,
        redirectUris: [{ uri: "https://app.example.com/cb" }],
      },
    };

    it("exchanges authorization code for token bundle", async () => {
      const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
      ctx.db.authorizationCode.findFirst.mockResolvedValue(baseAuthCode);
      ctx.db.session.findFirst.mockResolvedValue({ id: "session-1", authLevel: "aal1" });

      const result = await tokenExchangeFlow.execute(
        {
          grant_type: "authorization_code",
          code: "valid-code",
          client_id: "test-client",
          redirect_uri: "https://app.example.com/cb",
          code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
          state: "xyz-state",
        },
        ctx,
      );

      expect(result).toMatchObject({ access_token: "at-jwt-123", token_type: "Bearer" });
      expect(ctx.db.authorizationCode.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 }, data: { consumed: true } }),
      );
      expect(mockTokenServiceIssue).toHaveBeenCalled();
    });

    it("throws invalid_grant when auth code is consumed", async () => {
      const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
      // findFirst filters on consumed:false — consumed codes return null
      ctx.db.authorizationCode.findFirst.mockResolvedValue(null);

      await expect(
        tokenExchangeFlow.execute(
          {
            grant_type: "authorization_code",
            code: "used-code",
            client_id: "test-client",
            redirect_uri: "https://app.example.com/cb",
            code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
          },
          ctx,
        ),
      ).rejects.toMatchObject({ message: expect.stringContaining("invalid or expired") });
    });

    it("throws invalid_grant when auth code is expired", async () => {
      const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
      // findFirst filters on expiresAt: { gt: new Date() } — expired codes return null
      ctx.db.authorizationCode.findFirst.mockResolvedValue(null);

      await expect(
        tokenExchangeFlow.execute(
          {
            grant_type: "authorization_code",
            code: "expired-code",
            client_id: "test-client",
            redirect_uri: "https://app.example.com/cb",
            code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
          },
          ctx,
        ),
      ).rejects.toMatchObject({ message: expect.stringContaining("invalid or expired") });
    });

    it("throws invalid_grant when PKCE verification fails", async () => {
      const { verifyPkce } = await import("../services/pkce.service");
      (verifyPkce as any).mockReturnValue(false);

      const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
      ctx.db.authorizationCode.findFirst.mockResolvedValue(baseAuthCode);
      ctx.db.session.findFirst.mockResolvedValue({ id: "session-1", authLevel: "aal1" });

      await expect(
        tokenExchangeFlow.execute(
          {
            grant_type: "authorization_code",
            code: "valid-code",
            client_id: "test-client",
            redirect_uri: "https://app.example.com/cb",
            code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
            state: "xyz-state",
          },
          ctx,
        ),
      ).rejects.toMatchObject({ message: expect.stringContaining("PKCE") });
    });

    it("throws invalidClient when client_id does not match auth code", async () => {
      const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
      ctx.db.authorizationCode.findFirst.mockResolvedValue(baseAuthCode);

      await expect(
        tokenExchangeFlow.execute(
          { grant_type: "authorization_code", code: "valid-code", client_id: "wrong-client", redirect_uri: "https://app.example.com/cb" },
          ctx,
        ),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("throws invalid_request when state mismatch", async () => {
      const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
      ctx.db.authorizationCode.findFirst.mockResolvedValue(baseAuthCode);

      await expect(
        tokenExchangeFlow.execute(
          {
            grant_type: "authorization_code",
            code: "valid-code",
            client_id: "test-client",
            redirect_uri: "https://app.example.com/cb",
            code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
            state: "wrong-state",
          },
          ctx,
        ),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("requires client_secret for confidential clients", async () => {
      const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
      ctx.db.authorizationCode.findFirst.mockResolvedValue({
        ...baseAuthCode,
        client: {
          ...baseAuthCode.client,
          public: false,
          clientSecret: "$argon2id$hashed-secret",
        },
      });

      await expect(
        tokenExchangeFlow.execute(
          {
            grant_type: "authorization_code",
            code: "valid-code",
            client_id: "test-client",
            redirect_uri: "https://app.example.com/cb",
            code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
            state: "xyz-state",
          },
          ctx,
        ),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("throws invalid_grant when no active session exists", async () => {
      const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
      ctx.db.authorizationCode.findFirst.mockResolvedValue(baseAuthCode);
      ctx.db.session.findFirst.mockResolvedValue(null);

      await expect(
        tokenExchangeFlow.execute(
          {
            grant_type: "authorization_code",
            code: "valid-code",
            client_id: "test-client",
            redirect_uri: "https://app.example.com/cb",
            code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
            state: "xyz-state",
          },
          ctx,
        ),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("client_credentials grant", () => {
    it("issues a token bundle for valid client credentials", async () => {
      mockFindByClientIdOrThrow.mockResolvedValue({
        id: 42,
        clientId: "service-client",
        scopes: ["api:read", "api:write"],
        clientSecret: "$argon2id$hashed-secret",
        public: false,
      });

      const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });
      mockTokenServiceIssue.mockResolvedValue(mockTokenBundle);

      // argon2.verify needs a mock — it's real import path
      const result = await tokenExchangeFlow.execute(
        {
          grant_type: "client_credentials",
          client_id: "service-client",
          client_secret: "my-secret",
          scope: "api:read api:write",
        },
        ctx,
      );

      expect(result).toMatchObject({ access_token: "at-jwt-123" });
      expect(mockTokenServiceIssue).toHaveBeenCalled();
    });

    it("throws invalidClient when client has no secret", async () => {
      mockFindByClientIdOrThrow.mockResolvedValue({
        id: 42,
        clientId: "public-client",
        scopes: ["openid"],
        clientSecret: null,
        public: true,
      });

      const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });

      await expect(
        tokenExchangeFlow.execute(
          { grant_type: "client_credentials", client_id: "public-client", client_secret: "" },
          ctx,
        ),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("throws invalidScope when requesting openid or offline_access", async () => {
      mockFindByClientIdOrThrow.mockResolvedValue({
        id: 42,
        clientId: "service-client",
        scopes: ["openid", "offline_access", "api:read"],
        clientSecret: "$argon2id$hashed-secret",
        public: false,
      });

      const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });

      await expect(
        tokenExchangeFlow.execute(
          {
            grant_type: "client_credentials",
            client_id: "service-client",
            client_secret: "my-secret",
            scope: "openid offline_access",
          },
          ctx,
        ),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  it("throws unsupported_grant_type for unknown grant type", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM" });

    await expect(
      tokenExchangeFlow.execute(
        { grant_type: "password" as any, client_id: "test-client", client_secret: "" },
        ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
