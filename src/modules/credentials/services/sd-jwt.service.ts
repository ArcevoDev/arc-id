// src/modules/credentials/services/sd-jwt.service.ts
// Selective Disclosure JWT — W3C SD-JWT VC Draft
//
// FIX: Previous version hardcoded { name: "ECDSA", hash: "SHA-256" } in
// crypto.subtle.sign/verify regardless of what `algorithm` was passed in.
// An RSA signing key (RS256, PS256) would throw DOMException at runtime.
// Now: algorithm → Web Crypto params mapping via algToSubtleParams().

import { SDJwtInstance } from "@sd-jwt/core";
import { digest, generateSalt } from "@sd-jwt/crypto-nodejs";
import { importPKCS8, importSPKI } from "jose";

// ── JWA → Web Crypto parameter map ────────────────────────────────────────────

type SubtleParams =
  | AlgorithmIdentifier
  | EcdsaParams
  | RsaPssParams
  | { name: "RSASSA-PKCS1-v1_5" };

function algToSubtleParams(alg: string): SubtleParams {
  switch (alg) {
    // ── ECDSA ─────────────────────────────────────────────────────────────────
    case "ES256":
      return { name: "ECDSA", hash: { name: "SHA-256" } };
    case "ES384":
      return { name: "ECDSA", hash: { name: "SHA-384" } };
    case "ES512":
      return { name: "ECDSA", hash: { name: "SHA-512" } };
    // ── RSASSA-PKCS1-v1_5 ─────────────────────────────────────────────────────
    case "RS256":
    case "RS384":
    case "RS512":
      return { name: "RSASSA-PKCS1-v1_5" };
    // ── RSA-PSS ───────────────────────────────────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────────

type SignCallback = (data: string) => Promise<string>;
type VerifyCallback = (data: string, sig: string) => Promise<boolean>;

// ── Key helpers ───────────────────────────────────────────────────────────────

/**
 * Build a Web Crypto signer from a PKCS8 PEM string or an already-imported CryptoKey.
 * The returned function is used as the `signer` callback by @sd-jwt/core.
 *
 * `algorithm` must be a JWA string (e.g. "ES256", "RS256", "PS256").
 * It determines BOTH how the PEM is imported AND which Web Crypto operation is used.
 */
async function buildSigner(
  privateKeyInput: CryptoKey | string,
  algorithm: string,
): Promise<SignCallback> {
  const subtleParams = algToSubtleParams(algorithm);

  const cryptoKey: CryptoKey =
    typeof privateKeyInput === "string"
      ? // importPKCS8 returns KeyLike; in Node.js this is always a CryptoKey.
        ((await importPKCS8(
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

/**
 * Build a Web Crypto verifier from an SPKI PEM string or an already-imported CryptoKey.
 * The returned function is used as the `verifier` callback by @sd-jwt/core.
 */
async function buildVerifier(
  publicKeyInput: CryptoKey | string,
  algorithm: string,
): Promise<VerifyCallback> {
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
   * Issue an SD-JWT VC.
   *
   * @param payload         The full VC payload (will be included as JWT claims).
   * @param privateKey      PKCS8 PEM string or an imported CryptoKey.
   * @param disclosableKeys Fields inside credentialSubject to make selectively disclosable.
   *                        Empty array = all credentialSubject fields except "id".
   * @param algorithm       JWA algorithm string matching the key type. Defaults to "ES256".
   *
   * @returns The compact SD-JWT string:  "header.payload.signature~disc1~disc2~"
   */
  async sign(
    payload: Record<string, unknown>,
    privateKey: CryptoKey | string,
    disclosableKeys: string[] = [],
    algorithm = "ES256",
  ): Promise<string> {
    const signer = await buildSigner(privateKey, algorithm);

    const instance = new SDJwtInstance<any, any>({
      signer,
      signAlg: algorithm,
      hasher: digest,
      hashAlg: "sha-256",
      saltGenerator: generateSalt,
    });

    // Auto-detect disclosable keys from credentialSubject if none provided.
    const subject =
      (payload as any)?.vc?.credentialSubject ??
      (payload as any)?.credentialSubject ??
      {};

    const keysToDisclose =
      disclosableKeys.length > 0
        ? disclosableKeys
        : Object.keys(subject).filter((k) => k !== "id");

    // @sd-jwt/core disclosureFrame: { fieldName: true } marks the field SD.
    const disclosureFrame: Record<string, boolean> = {};
    for (const key of keysToDisclose) {
      disclosureFrame[key] = true;
    }

    const claims: Record<string, unknown> = {
      ...payload,
      vct: "VerifiableCredential",
    };

    return instance.issue(claims as any, { disclosureFrame } as any);
  }

  /**
   * Verify an SD-JWT VC and return the disclosed claim payload.
   *
   * @param sdJwt     The compact SD-JWT string.
   * @param publicKey SPKI PEM string or an imported CryptoKey.
   * @param algorithm JWA algorithm string. Must match the key used to sign.
   */
  async verify(
    sdJwt: string,
    publicKey: CryptoKey | string,
    algorithm = "ES256",
  ): Promise<Record<string, unknown>> {
    const verifier = await buildVerifier(publicKey, algorithm);

    const instance = new SDJwtInstance<any, any>({
      verifier,
      hasher: digest,
      hashAlg: "sha-256",
      saltGenerator: generateSalt,
    });

    const verified = await instance.verify(sdJwt);
    return verified.payload as Record<string, unknown>;
  }
}
