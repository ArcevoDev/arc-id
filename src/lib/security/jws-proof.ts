// src/lib/security/jws-proof.ts
//
// Verifies a detached JWS proof that binds a holder's did:key to a
// specific credential via a challenge nonce.
//
// The proof JWS structure:
//   Protected header: { alg, kid: "<did:key>#key-1", nonce: "<challenge>" }
//   Payload:          { credentialHash: "<sha256>" }
//   Signature:        Ed25519 or ECDSA over base64url(header) || "." || base64url(payload)

import type { DbClient } from "@/lib/db-client";
import { compactVerify, importJWK, base64url } from "jose";
import type { KeyType } from "@prisma-client";

/**
 * Resolve a did:key's public key bytes to a jose-compatible CryptoKey.
 */
async function didKeyToPublicKey(
  publicKeyBytes: Uint8Array, // Changed from Buffer to Uint8Array
  keyType: KeyType,
): Promise<CryptoKey> {
  switch (keyType) {
    case "Ed25519VerificationKey2020": {
      // Safely wrap Uint8Array to call toString("base64url")
      const x = Buffer.from(publicKeyBytes).toString("base64url");
      return importJWK(
        { kty: "OKP", crv: "Ed25519", x },
        "Ed25519",
      ) as Promise<CryptoKey>;
    }

    case "JsonWebKey2020": {
      // SEC1 uncompressed EC point: 0x04 || x || y
      const raw = new Uint8Array(publicKeyBytes);
      if (raw[0] !== 0x04 || raw.length < 3) {
        throw new Error("Invalid SEC1 uncompressed point");
      }
      const pointLen = (raw.length - 1) / 2;
      const xBytes = raw.subarray(1, 1 + pointLen);
      const yBytes = raw.subarray(1 + pointLen);

      let crv: string;
      let alg: string;
      if (pointLen === 32) {
        crv = "P-256";
        alg = "ES256";
      } else if (pointLen === 48) {
        crv = "P-384";
        alg = "ES384";
      } else if (pointLen === 66) {
        crv = "P-521";
        alg = "ES512";
      } else {
        throw new Error(`Unsupported EC key length: ${pointLen} bytes`);
      }

      const x = Buffer.from(xBytes).toString("base64url");
      const y = Buffer.from(yBytes).toString("base64url");
      return importJWK({ kty: "EC", crv, x, y }, alg) as Promise<CryptoKey>;
    }

    default:
      throw new Error(
        `Unsupported key type for proof verification: ${keyType}`,
      );
  }
}

/**
 * Verify a detached JWS proof.
 *
 * @param proof                  - The detached JWS string (header..signature).
 * @param expectedNonce          - The challenge nonce expected in the protected header.
 * @param expectedCredentialHash - The SHA-256 hash of the credential, expected in the payload.
 * @param didKey                 - The holder's full did:key string (e.g. "did:key:z6Mk...").
 * @param db                     - Prisma client for DID resolution.
 * @returns true if the proof is valid, false otherwise.
 */
export async function verifyDetachedJws(
  proof: string,
  expectedNonce: string,
  expectedCredentialHash: string,
  didKey: string,
  db: DbClient,
): Promise<boolean> {
  try {
    // 1. Resolve the holder's did:key
    const did = await db.decentralizedIdentifier.findUnique({
      where: { id: didKey },
      select: { publicKeyBytes: true, keyType: true },
    });
    if (!did) return false;

    // 2. Convert stored public key bytes to a CryptoKey
    const publicKey = await didKeyToPublicKey(did.publicKeyBytes, did.keyType);

    // 3. Reconstruct the complete JWS token using the detached payload
    const payloadBytes = new TextEncoder().encode(
      JSON.stringify({ credentialHash: expectedCredentialHash }),
    );
    const payloadB64u = base64url.encode(payloadBytes);

    const parts = proof.split(".");
    if (parts.length !== 3) return false;

    // Inject the base64url payload into the missing middle slot ("header..signature")
    const fullJws = `${parts[0]}.${payloadB64u}.${parts[2]}`;

    // 4. Verify the reconstructed token
    const { protectedHeader } = await compactVerify(fullJws, publicKey);

    // 5. Verify nonce in the protected header matches the session challenge
    const headerNonce = (protectedHeader as Record<string, unknown>).nonce;
    if (headerNonce !== expectedNonce) return false;

    // 6. Verify kid references the expected DID
    const kid = protectedHeader.kid;
    if (kid && !kid.startsWith(didKey)) return false;

    return true;
  } catch {
    return false;
  }
}
