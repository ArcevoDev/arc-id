// src/modules/credentials/services/sd-jwt.service.ts
// Selective Disclosure JWT — W3C SD-JWT VC Draft (sd-jwt-js v0.19.x)
//
// FIXES IN THIS VERSION:
// 1. Fixed Hasher type definition compatibility (handles string | ArrayBuffer).
// 2. Kept self-contained Node.js crypto replacements.
// 3. Maintained proper SDJwtVcInstance API usages.

import { SDJwtVcInstance } from "@sd-jwt/sd-jwt-vc";
import type { Signer, Verifier, Hasher, SaltGenerator } from "@sd-jwt/types";
import { createHash, randomBytes } from "crypto";
import { importPKCS8, importSPKI } from "jose";

// ── Built-in crypto replacements for @sd-jwt/crypto-nodejs ────────────────────

/** SHA-256 hasher — replaces `digest` from @sd-jwt/crypto-nodejs */
const sdJwtHasher: Hasher = async (
  data: string | ArrayBuffer,
): Promise<Uint8Array> => {
  const input = typeof data === "string" ? data : Buffer.from(data);
  return new Uint8Array(createHash("sha256").update(input).digest());
};

/** Random base64url salt — replaces `generateSalt` from @sd-jwt/crypto-nodejs */
const sdJwtSaltGenerator: SaltGenerator = async (
  length: number,
): Promise<string> => {
  return randomBytes(length).toString("base64url");
};

// ── JWA → Web Crypto parameter map ────────────────────────────────────────────

type SubtleParams =
  | AlgorithmIdentifier
  | EcdsaParams
  | RsaPssParams
  | { name: "RSASSA-PKCS1-v1_5" };

function algToSubtleParams(alg: string): SubtleParams {
  switch (alg) {
    case "ES256":
      return { name: "ECDSA", hash: { name: "SHA-256" } };
    case "ES384":
      return { name: "ECDSA", hash: { name: "SHA-384" } };
    case "ES512":
      return { name: "ECDSA", hash: { name: "SHA-512" } };
    case "RS256":
    case "RS384":
    case "RS512":
      return { name: "RSASSA-PKCS1-v1_5" };
    case "PS256":
      return { name: "RSA-PSS", saltLength: 32 };
    case "PS384":
      return { name: "RSA-PSS", saltLength: 48 };
    case "PS512":
      return { name: "RSA-PSS", saltLength: 64 };
    default:
      throw new Error(
        `SD-JWT: unsupported algorithm "${alg}". ` +
          `Supported: ES256, ES384, ES512, RS256, RS384, RS512, PS256, PS384, PS512`,
      );
  }
}

// ── Key helpers ───────────────────────────────────────────────────────────────

async function buildSigner(
  privateKeyInput: CryptoKey | string,
  algorithm: string,
): Promise<Signer> {
  const subtleParams = algToSubtleParams(algorithm);

  const cryptoKey: CryptoKey =
    typeof privateKeyInput === "string"
      ? ((await importPKCS8(
          privateKeyInput,
          algorithm,
        )) as unknown as CryptoKey)
      : privateKeyInput;

  return async (data: string): Promise<string> => {
    const encoded = new TextEncoder().encode(data);
    const signature = await crypto.subtle.sign(
      subtleParams,
      cryptoKey,
      encoded,
    );
    return Buffer.from(signature).toString("base64url");
  };
}

async function buildVerifier(
  publicKeyInput: CryptoKey | string,
  algorithm: string,
): Promise<Verifier> {
  const subtleParams = algToSubtleParams(algorithm);

  const cryptoKey: CryptoKey =
    typeof publicKeyInput === "string"
      ? ((await importSPKI(publicKeyInput, algorithm)) as unknown as CryptoKey)
      : publicKeyInput;

  return async (data: string, sig: string): Promise<boolean> => {
    try {
      const encoded = new TextEncoder().encode(data);
      const sigBytes = Buffer.from(sig, "base64url");
      return await crypto.subtle.verify(
        subtleParams,
        cryptoKey,
        sigBytes,
        encoded,
      );
    } catch {
      return false;
    }
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export class SdJwtService {
  /**
   * Issue a W3C SD-JWT VC.
   *
   * @param payload         Full VC claims object. `vct` is added automatically.
   * @param privateKey      PKCS8 PEM string or an imported CryptoKey.
   * @param disclosableKeys Fields to make selectively disclosable.
   * Empty array = all credentialSubject fields except "id".
   * @param algorithm       JWA algorithm string. Defaults to "ES256".
   *
   * @returns Compact SD-JWT string: "header.payload.sig~disclosure1~disclosure2~"
   */
  async sign(
    payload: Record<string, unknown>,
    privateKey: CryptoKey | string,
    disclosableKeys: string[] = [],
    algorithm = "ES256",
  ): Promise<string> {
    const signer = await buildSigner(privateKey, algorithm);

    const instance = new SDJwtVcInstance({
      signer,
      signAlg: algorithm,
      hasher: sdJwtHasher,
      hasherAlg: "sha-256",
      saltGenerator: sdJwtSaltGenerator,
    } as any);

    // Resolve which fields in credentialSubject to make selectively disclosable.
    const subject: Record<string, unknown> =
      (payload as any)?.vc?.credentialSubject ??
      (payload as any)?.credentialSubject ??
      {};

    const keysToDisclose =
      disclosableKeys.length > 0
        ? disclosableKeys
        : Object.keys(subject).filter((k) => k !== "id");

    const claims: Record<string, unknown> = {
      ...payload,
      vct: "VerifiableCredential", // required by SD-JWT VC spec
    };

    return instance.issue(claims as any, { _sd: keysToDisclose } as any);
  }

  /**
   * Verify a W3C SD-JWT VC and return the disclosed claim payload.
   *
   * @param sdJwt     Compact SD-JWT string.
   * @param publicKey SPKI PEM string or an imported CryptoKey.
   * @param algorithm JWA algorithm. Must match the signing key.
   */
  async verify(
    sdJwt: string,
    publicKey: CryptoKey | string,
    algorithm = "ES256",
  ): Promise<Record<string, unknown>> {
    const verifier = await buildVerifier(publicKey, algorithm);

    const instance = new SDJwtVcInstance({
      verifier,
      hasher: sdJwtHasher,
      hasherAlg: "sha-256",
      saltGenerator: sdJwtSaltGenerator,
    } as any);

    const verified = await instance.verify(sdJwt);
    return (verified.payload ?? {}) as Record<string, unknown>;
  }
}
