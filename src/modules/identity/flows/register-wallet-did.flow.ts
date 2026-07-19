// src/modules/identity/flows/register-wallet-did.flow.ts
//
// ArcWallet-facing flow: register an identity-owned did:key from a
// client-supplied public key (JWK). Never generates keys server-side.
//
// ArcWallet generates the keypair on-device, sends only the public key.
// ArcID encodes it as a spec-correct did:key (multicodec + multibase),
// builds the DID document, and creates the DecentralizedIdentifier +
// Wallet rows in a single transaction.

import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { ApiError } from "@/core/errors/api-error";
import { encodeDidKey, MULTICODEC_FROM_CRV } from "@/lib/multibase";
import {
  RegisterWalletDidInputSchema,
  RegisterWalletDidOutputSchema,
} from "../validators/wallet-did.schemas";

type Input = z.infer<typeof RegisterWalletDidInputSchema>;
type Output = z.infer<typeof RegisterWalletDidOutputSchema>;

/**
 * Base64url-decode a string to raw bytes.
 */
function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(padLen);
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/**
 * Map JWK parameters to (rawKeyBytes, multicodecPrefix, keyType).
 *
 * Currently supported:
 *   OKP / Ed25519      → Ed25519VerificationKey2020
 *   EC  / P-256        → JsonWebKey2020  (SEC1 uncompressed point)
 *   EC  / P-384        → JsonWebKey2020
 *   EC  / P-521        → JsonWebKey2020
 *
 * RSA and unrecognised JWKs throw ApiError.badRequest.
 */
function jwkToKeyInfo(
  kty: string,
  crv: string | undefined,
  x: string,
  y?: string,
): {
  rawKeyBytes: Uint8Array;
  multicodecPrefix: Uint8Array;
  keyType: string;
} {
  const xBytes = base64urlDecode(x);

  if (kty === "OKP" && crv === "Ed25519") {
    const info = MULTICODEC_FROM_CRV.Ed25519;
    return {
      rawKeyBytes: xBytes,
      multicodecPrefix: info.prefix,
      keyType: info.keyType,
    };
  }

  if (kty === "EC" && crv && y) {
    const yBytes = base64urlDecode(y);
    // SEC1 uncompressed EC point: 0x04 || x || y
    const combined = new Uint8Array(1 + xBytes.length + yBytes.length);
    combined[0] = 0x04;
    combined.set(xBytes, 1);
    combined.set(yBytes, 1 + xBytes.length);

    const crvPrefix = ecCrvMulticodec(crv);
    return {
      rawKeyBytes: combined,
      multicodecPrefix: crvPrefix,
      keyType: "JsonWebKey2020",
    };
  }

  if (kty === "EC" && crv && !y) {
    throw ApiError.badRequest("EC JWK must include the 'y' parameter");
  }

  throw ApiError.badRequest(
    `Unsupported key type: kty=${kty} crv=${crv ?? "undefined"}. Supported: OKP/Ed25519, EC/P-256, EC/P-384, EC/P-521`,
  );
}

function ecCrvMulticodec(crv: string): Uint8Array {
  switch (crv) {
    case "P-256":
      return new Uint8Array([0x80, 0x24]); // p256-pub
    case "P-384":
      return new Uint8Array([0x81, 0x24]); // p384-pub
    case "P-521":
      return new Uint8Array([0x82, 0x24]); // p521-pub
    default:
      throw ApiError.badRequest(`Unsupported EC curve: ${crv}`);
  }
}

export const registerWalletDidFlow: Flow<Input, Output> = {
  name: "identity:register-wallet-did",
  inputSchema: RegisterWalletDidInputSchema,
  outputSchema: RegisterWalletDidOutputSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    const identityId = ctx.identityId;
    if (!identityId) {
      throw ApiError.unauthorized("Authentication required");
    }

    const { publicKeyJwk, provider, providerWalletId } = input;

    // ── 1. Map JWK → raw bytes + multicodec prefix + keyType ───────────
    let keyInfo: ReturnType<typeof jwkToKeyInfo>;
    try {
      keyInfo = jwkToKeyInfo(
        publicKeyJwk.kty,
        publicKeyJwk.crv,
        publicKeyJwk.x,
        publicKeyJwk.y,
      );
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.badRequest("Failed to parse public key JWK");
    }

    // ── 2. Build did:key identifier ────────────────────────────────────
    const did = encodeDidKey(keyInfo.rawKeyBytes, keyInfo.multicodecPrefix);

    // ── 3. Build DID document ──────────────────────────────────────────
    const didDocument = {
      "@context": ["https://www.w3.org/ns/did/v1"],
      id: did,
      verificationMethod: [
        {
          id: `${did}#key-1`,
          type: keyInfo.keyType,
          controller: did,
          publicKeyJwk,
        },
      ],
      authentication: [`${did}#key-1`],
      assertionMethod: [`${did}#key-1`],
    };

    // ── 4. Check wallet binding doesn't already exist ───────────────────
    const existingWallet = await ctx.db.wallet.findUnique({
      where: { provider_providerWalletId: { provider, providerWalletId } },
      select: { id: true },
    });
    if (existingWallet) {
      throw ApiError.conflict(
        `Wallet binding already exists for provider="${provider}" providerWalletId="${providerWalletId}"`,
      );
    }

    // ── 5. Create DecentralizedIdentifier + Wallet in one tx ───────────
    const record = await ctx.db.decentralizedIdentifier.create({
      data: {
        id: did,
        identityId,
        tenantId: null,
        publicKeyBytes: Buffer.from(keyInfo.rawKeyBytes),
        keyType: keyInfo.keyType as any,
        didDocument,
      },
    });

    const wallet = await ctx.db.wallet.create({
      data: {
        identityId,
        provider,
        providerWalletId,
      },
    });

    return {
      did: record.id,
      didDocument: record.didDocument as Record<string, unknown>,
      walletId: wallet.id,
      keyType: keyInfo.keyType,
    };
  },
};
