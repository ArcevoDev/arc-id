// src/modules/oauth/flows/authorize.flow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGenerateToken } = vi.hoisted(() => ({
  mockGenerateToken: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));

vi.mock("@prisma-client", () => ({
  VcFormat: {},
  StatusPurpose: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
  PrismaClient: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  generateToken: mockGenerateToken,
}));

const mockFindByClientIdOrThrow = vi.fn();
const mockValidateRedirectUri = vi.fn();
vi.mock("@/modules/oauth/repositories/client.repository", () => ({
  ClientRepository: vi.fn().mockImplementation(function () {
    return {
      findByClientIdOrThrow: mockFindByClientIdOrThrow,
      validateRedirectUri: mockValidateRedirectUri,
    };
  }),
}));

const mockHasConsent = vi.fn();
vi.mock("@/modules/oauth/services/consent.service", () => ({
  ConsentService: vi.fn().mockImplementation(function () {
    return { hasConsent: mockHasConsent };
  }),
}));

import { authorizeFlow } from "./authorize.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";
import { addMinutes } from "date-fns";

const baseClient = {
  id: 42,
  clientId: "test-client",
  name: "Test Client",
  scopes: ["openid", "profile", "email"],
  requirePkce: true,
};

describe("authorizeFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByClientIdOrThrow.mockReset().mockResolvedValue(baseClient);
    mockValidateRedirectUri.mockReset().mockResolvedValue(true);
    mockHasConsent.mockReset().mockResolvedValue(true);
    mockGenerateToken.mockReset().mockReturnValue("auth-code-123");
  });

  it("throws unauthorized when identityId is missing", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: undefined });

    await expect(
      authorizeFlow.execute(
        { client_id: "test-client", redirect_uri: "https://app.example.com/cb", response_type: "code", scope: "openid profile email" },
        ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("returns an authorization code with valid input and existing consent", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    ctx.db.authorizationCode.create.mockResolvedValue({ id: "ac-1" });

    const result = await authorizeFlow.execute(
      {
        client_id: "test-client",
        redirect_uri: "https://app.example.com/cb",
        response_type: "code",
        scope: "openid profile email",
        code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        code_challenge_method: "S256",
        state: "xyz-state",
      },
      ctx,
    );

    expect(result).toMatchObject({ code: "auth-code-123", state: "xyz-state", consentRequired: false });
    expect(mockFindByClientIdOrThrow).toHaveBeenCalledWith("test-client", "SYSTEM");
    expect(mockValidateRedirectUri).toHaveBeenCalledWith(42, "https://app.example.com/cb");
    expect(ctx.db.authorizationCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "auth-code-123", clientId: 42, identityId: "identity-1" }),
      }),
    );
  });

  it("throws invalidRequest when redirect_uri is not registered", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    mockValidateRedirectUri.mockResolvedValue(false);

    await expect(
      authorizeFlow.execute(
        { client_id: "test-client", redirect_uri: "https://evil.com/cb", response_type: "code", scope: "openid profile email" },
        ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws invalidRequest when PKCE is required but code_challenge is missing", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });

    await expect(
      authorizeFlow.execute(
        { client_id: "test-client", redirect_uri: "https://app.example.com/cb", response_type: "code", scope: "openid profile email" },
        ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns interaction_required when prompt=login", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    ctx.db.session.findFirst.mockResolvedValue({
      createdAt: new Date(),
      authLevel: "aal1",
    });

    await expect(
      authorizeFlow.execute(
        {
          client_id: "test-client",
          redirect_uri: "https://app.example.com/cb",
          response_type: "code",
          scope: "openid profile email",
          code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
          code_challenge_method: "S256",
          prompt: "login",
        },
        ctx,
      ),
    ).rejects.toMatchObject({ code: "interaction_required" });
  });

  it("returns login_required when prompt=none and max_age demands re-auth", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    // Session is from 2 hours ago — max_age=600 (10 min) exceeds it
    ctx.db.session.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 2 * 3600 * 1000),
      authLevel: "aal1",
    });

    await expect(
      authorizeFlow.execute(
        {
          client_id: "test-client",
          redirect_uri: "https://app.example.com/cb",
          response_type: "code",
          scope: "openid profile email",
          code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
          code_challenge_method: "S256",
          prompt: "none",
          max_age: 600,
        },
        ctx,
      ),
    ).rejects.toMatchObject({ code: "login_required" });
  });

  it("returns consent_required when prompt=none and no consent exists", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    mockHasConsent.mockResolvedValue(false);

    await expect(
      authorizeFlow.execute(
        {
          client_id: "test-client",
          redirect_uri: "https://app.example.com/cb",
          response_type: "code",
          scope: "openid profile email",
          code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
          code_challenge_method: "S256",
          prompt: "none",
        },
        ctx,
      ),
    ).rejects.toMatchObject({ code: "consent_required" });
  });

  it("returns consentRequired when no consent exists (not prompt=none)", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    mockHasConsent.mockResolvedValue(false);

    const result = await authorizeFlow.execute(
      {
        client_id: "test-client",
        redirect_uri: "https://app.example.com/cb",
        response_type: "code",
        scope: "openid profile email",
        code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        code_challenge_method: "S256",
      },
      ctx,
    );

    expect(result).toMatchObject({ consentRequired: true, clientName: "Test Client" });
  });

  it("respects prompt=consent to force consent screen", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    mockHasConsent.mockResolvedValue(true);

    const result = await authorizeFlow.execute(
      {
        client_id: "test-client",
        redirect_uri: "https://app.example.com/cb",
        response_type: "code",
        scope: "openid profile email",
        code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        code_challenge_method: "S256",
        prompt: "consent",
      },
      ctx,
    );

    // Even though hasConsent would return true, prompt=consent forces consentRequired
    expect(result).toMatchObject({ consentRequired: true });
  });

  it("throws interaction_required when max_age exceeds session age", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    // Session was created 2 hours ago
    ctx.db.session.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 2 * 3600 * 1000),
      authLevel: "aal1",
    });

    await expect(
      authorizeFlow.execute(
        {
          client_id: "test-client",
          redirect_uri: "https://app.example.com/cb",
          response_type: "code",
          scope: "openid profile email",
          code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
          code_challenge_method: "S256",
          max_age: 600, // 10 minutes — session is 2 hours old
        },
        ctx,
      ),
    ).rejects.toMatchObject({ code: "interaction_required" });
  });

  it("proceeds when max_age is within session age", async () => {
    const ctx = createMockFlowCtx({ tenantId: "SYSTEM", identityId: "identity-1" });
    ctx.db.session.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
      authLevel: "aal1",
    });
    ctx.db.authorizationCode.create.mockResolvedValue({ id: "ac-1" });

    const result = await authorizeFlow.execute(
      {
        client_id: "test-client",
        redirect_uri: "https://app.example.com/cb",
        response_type: "code",
        scope: "openid profile email",
        code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        code_challenge_method: "S256",
        max_age: 3600, // 1 hour — session is 1 minute old, OK
      },
      ctx,
    ) as { consentRequired: boolean };

    expect(result.consentRequired).toBe(false);
  });
});
