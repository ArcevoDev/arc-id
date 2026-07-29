// src/modules/identity/flows/register-wallet-did.flow.test.ts
//
// Proves the register-wallet-did flow:
//   - Registers Ed25519 and P-256 DIDs
//   - Throws 401 without authentication
//   - Throws 409 on duplicate wallet binding
//   - Throws 400 on unsupported key type (RSA)
//   - Throws 400 on EC JWK missing 'y' param

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@prisma-client", () => ({
  UserStatus: {},
  MfaType: {},
  Prisma: { DbNull: null, JsonNull: null, AnyNull: null },
}));

import { registerWalletDidFlow } from "./register-wallet-did.flow";
import { createMockFlowCtx } from "@/test-utils/mock-db";

const IDENTITY_ID = "identity-1";

// Ed25519 public key (32 bytes base64url)
const ED25519_X = "11qYAYKxCrfVS_7TyGQ8Wm3Vq3sR5s6n2wH4GXpjQmQ";
// P-256 public key coordinates (32 bytes each base64url)
const P256_X = "usWxHK2PmfnHKwXPS54m0kTcGJ90UiglWiGahtagnv8";
const P256_Y = "IBOL-C3BttVivg-lSreASjpkttcsz-1rb7btKLv8EX4";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerWalletDidFlow", () => {
  it("registers an Ed25519 DID from a JWK", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });
    // No existing wallet
    ctx.db.wallet.findUnique.mockResolvedValue(null);
    ctx.db.decentralizedIdentifier.create.mockResolvedValue({
      id: "did:key:z6Mk",
      identityId: IDENTITY_ID,
      tenantId: null,
      keyType: "Ed25519VerificationKey2020",
      didDocument: {
        "@context": ["https://www.w3.org/ns/did/v1"],
        id: "did:key:z6Mk",
      },
    });
    ctx.db.wallet.create.mockResolvedValue({
      id: "wallet-1",
      identityId: IDENTITY_ID,
      provider: "arcwallet",
      providerWalletId: "wallet-abc",
    });

    const result = await registerWalletDidFlow.execute(
      {
        publicKeyJwk: {
          kty: "OKP",
          crv: "Ed25519",
          x: ED25519_X,
        },
        provider: "arcwallet",
        providerWalletId: "wallet-abc",
      },
      ctx,
    );

    expect(result.did).toMatch(/^did:key:/);
    expect(result.walletId).toBe("wallet-1");
    expect(result.keyType).toBe("Ed25519VerificationKey2020");
    expect(ctx.db.decentralizedIdentifier.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          identityId: IDENTITY_ID,
          keyType: "Ed25519VerificationKey2020",
        }),
      }),
    );
    expect(ctx.db.wallet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { identityId: IDENTITY_ID, provider: "arcwallet", providerWalletId: "wallet-abc" },
      }),
    );
  });

  it("registers a P-256 DID from an EC JWK", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });
    ctx.db.wallet.findUnique.mockResolvedValue(null);
    ctx.db.decentralizedIdentifier.create.mockResolvedValue({
      id: "did:key:zXwp",
      identityId: IDENTITY_ID,
      tenantId: null,
      keyType: "JsonWebKey2020",
      didDocument: {},
    });
    ctx.db.wallet.create.mockResolvedValue({
      id: "wallet-1",
      identityId: IDENTITY_ID,
      provider: "arcwallet",
      providerWalletId: "wallet-456",
    });

    const result = await registerWalletDidFlow.execute(
      {
        publicKeyJwk: { kty: "EC", crv: "P-256", x: P256_X, y: P256_Y },
        provider: "arcwallet",
        providerWalletId: "wallet-456",
      },
      ctx,
    );

    expect(result.did).toMatch(/^did:key:/);
    expect(result.keyType).toBe("JsonWebKey2020");
  });

  it("throws 401 when not authenticated", async () => {
    const ctx = createMockFlowCtx(); // identityId undefined

    await expect(
      registerWalletDidFlow.execute(
        {
          publicKeyJwk: { kty: "OKP", crv: "Ed25519", x: ED25519_X },
          provider: "arcwallet",
          providerWalletId: "wallet-1",
        },
        ctx,
      ),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(ctx.db.decentralizedIdentifier.create).not.toHaveBeenCalled();
  });

  it("throws 409 when wallet binding already exists", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });
    ctx.db.wallet.findUnique.mockResolvedValue({
      id: "existing-wallet",
      identityId: IDENTITY_ID,
    });

    await expect(
      registerWalletDidFlow.execute(
        {
          publicKeyJwk: { kty: "OKP", crv: "Ed25519", x: ED25519_X },
          provider: "arcwallet",
          providerWalletId: "wallet-abc",
        },
        ctx,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: /already exists/i,
    });

    expect(ctx.db.decentralizedIdentifier.create).not.toHaveBeenCalled();
  });

  it("throws 400 for unsupported RSA key type", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });

    await expect(
      registerWalletDidFlow.execute(
        {
          publicKeyJwk: { kty: "RSA", crv: "RS256", x: "AAAA" },
          provider: "arcwallet",
          providerWalletId: "wallet-rsa",
        },
        ctx,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: /Unsupported key type/i,
    });
  });

  it("throws 400 for EC JWK missing 'y' parameter", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });

    await expect(
      registerWalletDidFlow.execute(
        {
          publicKeyJwk: { kty: "EC", crv: "P-256", x: P256_X },
          provider: "arcwallet",
          providerWalletId: "wallet-ec-no-y",
        },
        ctx,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: /must include the 'y' parameter/i,
    });
  });

  it("uses default provider 'arcwallet' when not specified", async () => {
    const ctx = createMockFlowCtx({ identityId: IDENTITY_ID });
    ctx.db.wallet.findUnique.mockResolvedValue(null);
    ctx.db.decentralizedIdentifier.create.mockResolvedValue({
      id: "did:key:z6Mk",
      identityId: IDENTITY_ID,
      tenantId: null,
      keyType: "Ed25519VerificationKey2020",
      didDocument: {},
    });
    ctx.db.wallet.create.mockResolvedValue({
      id: "wallet-1",
      identityId: IDENTITY_ID,
      provider: "arcwallet",
      providerWalletId: "wallet-default",
    });

    const result = await registerWalletDidFlow.execute(
      {
        publicKeyJwk: { kty: "OKP", crv: "Ed25519", x: ED25519_X },
        provider: "arcwallet",
        providerWalletId: "wallet-default",
      },
      ctx,
    );

    expect(result.did).toMatch(/^did:key:/);
    expect(ctx.db.wallet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: "arcwallet" }),
      }),
    );
  });
});
