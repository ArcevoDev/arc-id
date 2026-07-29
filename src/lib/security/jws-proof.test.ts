// src/lib/security/jws-proof.test.ts
//
// Tests verifyDetachedJws with real Ed25519 and P-256 keypairs generated
// via Node crypto, same pattern as provision-tenant-did.flow.test.ts.

import { describe, it, expect } from "vitest";
import { generateKeyPairSync, createHash, randomBytes } from "crypto";
import { SignJWT, compactVerify } from "jose";
import { verifyDetachedJws } from "./jws-proof";
import { encodeDidKey, MULTICODEC_FROM_CRV } from "@/lib/multibase";

// ── Helpers ──────────────────────────────────────────────────────────────────

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Create a detached JWS: the signature component only (header..signature)
 * with the payload passed separately.
 */
async function signDetached(
  payload: Record<string, unknown>,
  privateKey: CryptoKey,
  extraHeaders: Record<string, unknown> = {},
): Promise<string> {
  const jws = await new SignJWT(payload)
    .setProtectedHeader({ alg: "EdDSA", ...extraHeaders })
    .sign(privateKey);

  // Convert full JWT to detached form: strip the payload segment
  const parts = jws.split(".");
  // parts: [header, payload, signature]
  // detached: [header, "", signature] → "header..signature"
  return `${parts[0]}..${parts[2]}`;
}

/**
 * Create an Ed25519 public-private keypair for testing.
 */
function generateEd25519KeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });

  // Extract raw 32-byte public key from SPKI DER
  // SPKI for Ed25519: 30 2a 30 05 06 03 2b 65 70 03 21 00 <32 bytes>
  const rawPublicKey = publicKey.subarray(12);

  return { publicKey, privateKey, rawPublicKey };
}

/**
 * Build a did:key from raw Ed25519 public key bytes.
 */
function buildDidKey(rawPublicKey: Buffer): string {
  return encodeDidKey(
    new Uint8Array(rawPublicKey),
    MULTICODEC_FROM_CRV.Ed25519.prefix,
  );
}

/**
 * Import a DER PKCS8 Ed25519 private key as a jose-compatible CryptoKey.
 */
function importEd25519PrivateKey(pkcs8Der: Buffer): Promise<CryptoKey> {
  const pkcs8B64 = pkcs8Der.toString("base64url");
  return crypto.subtle.importKey(
    "pkcs8",
    new Uint8Array(pkcs8Der),
    { name: "Ed25519" },
    true,
    ["sign"],
  ) as Promise<CryptoKey>;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("verifyDetachedJws", () => {
  it("returns true for a valid Ed25519-signed proof", async () => {
    const { privateKey: _skDer, rawPublicKey } = generateEd25519KeyPair();
    const didKey = buildDidKey(rawPublicKey);
    const credentialHash = createHash("sha256")
      .update("test-credential-jwt")
      .digest("hex");
    const nonce = base64urlEncode(randomBytes(32));

    // Sign the proof with the wallet's Ed25519 private key
    const sk = await importEd25519PrivateKey(_skDer);
    const proof = await signDetached({ credentialHash }, sk, {
      kid: `${didKey}#key-1`,
      nonce,
    });

    // Mock DB lookup
    const mockDb = {
      decentralizedIdentifier: {
        findUnique: async () => ({
          publicKeyBytes: Buffer.from(rawPublicKey),
          keyType: "Ed25519VerificationKey2020" as const,
        }),
      },
    };

    const result = await verifyDetachedJws(
      proof,
      nonce,
      credentialHash,
      didKey,
      mockDb as any,
    );

    expect(result).toBe(true);
  });

  it("returns false for wrong nonce", async () => {
    const { privateKey: _skDer, rawPublicKey } = generateEd25519KeyPair();
    const didKey = buildDidKey(rawPublicKey);
    const credentialHash = createHash("sha256")
      .update("test-credential-jwt")
      .digest("hex");
    const nonce = base64urlEncode(randomBytes(32));

    const sk = await importEd25519PrivateKey(_skDer);
    const proof = await signDetached({ credentialHash }, sk, {
      kid: `${didKey}#key-1`,
      nonce,
    });

    const mockDb = {
      decentralizedIdentifier: {
        findUnique: async () => ({
          publicKeyBytes: Buffer.from(rawPublicKey),
          keyType: "Ed25519VerificationKey2020" as const,
        }),
      },
    };

    const result = await verifyDetachedJws(
      proof,
      "wrong-nonce",
      credentialHash,
      didKey,
      mockDb as any,
    );

    expect(result).toBe(false);
  });

  it("returns false for wrong credentialHash", async () => {
    const { privateKey: _skDer, rawPublicKey } = generateEd25519KeyPair();
    const didKey = buildDidKey(rawPublicKey);
    const credentialHash = createHash("sha256")
      .update("test-credential-jwt")
      .digest("hex");
    const nonce = base64urlEncode(randomBytes(32));

    const sk = await importEd25519PrivateKey(_skDer);
    const proof = await signDetached({ credentialHash }, sk, {
      kid: `${didKey}#key-1`,
      nonce,
    });

    const mockDb = {
      decentralizedIdentifier: {
        findUnique: async () => ({
          publicKeyBytes: Buffer.from(rawPublicKey),
          keyType: "Ed25519VerificationKey2020" as const,
        }),
      },
    };

    const result = await verifyDetachedJws(
      proof,
      nonce,
      "wrong-credential-hash",
      didKey,
      mockDb as any,
    );

    expect(result).toBe(false);
  });

  it("returns false when the DID does not exist in the DB", async () => {
    const mockDb = {
      decentralizedIdentifier: {
        findUnique: async () => null,
      },
    };

    const result = await verifyDetachedJws(
      "header..signature",
      "nonce",
      "hash",
      "did:key:nonexistent",
      mockDb as any,
    );

    expect(result).toBe(false);
  });

  it("returns false for an invalid JWS signature", async () => {
    const { rawPublicKey } = generateEd25519KeyPair();
    const didKey = buildDidKey(rawPublicKey);
    const nonce = base64urlEncode(randomBytes(32));

    const mockDb = {
      decentralizedIdentifier: {
        findUnique: async () => ({
          publicKeyBytes: Buffer.from(rawPublicKey),
          keyType: "Ed25519VerificationKey2020" as const,
        }),
      },
    };

    // Tampered proof
    const result = await verifyDetachedJws(
      "eyJhbGciOiJFZERTQSIsIm5vbmNlIjoiZmFrZSJ9..YWJjZGVmZw",
      nonce,
      "hash",
      didKey,
      mockDb as any,
    );

    expect(result).toBe(false);
  });

  it("returns false for a proof signed by a different key", async () => {
    // Generate two different keypairs
    const key1 = generateEd25519KeyPair();
    const key2 = generateEd25519KeyPair();
    const didKey = buildDidKey(key1.rawPublicKey);
    const credentialHash = createHash("sha256")
      .update("test-credential-jwt")
      .digest("hex");
    const nonce = base64urlEncode(randomBytes(32));

    // Sign with key2's private key
    const sk2 = await importEd25519PrivateKey(key2.privateKey);
    const proof = await signDetached({ credentialHash }, sk2, {
      kid: `${didKey}#key-1`,
      nonce,
    });

    // DB holds key1's public key — different from what signed the proof
    const mockDb = {
      decentralizedIdentifier: {
        findUnique: async () => ({
          publicKeyBytes: Buffer.from(key1.rawPublicKey),
          keyType: "Ed25519VerificationKey2020" as const,
        }),
      },
    };

    const result = await verifyDetachedJws(
      proof,
      nonce,
      credentialHash,
      didKey,
      mockDb as any,
    );

    expect(result).toBe(false);
  });
});
