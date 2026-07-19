// src/lib/multibase.ts
//
// Multibase + multicodec helpers for DID document construction.
//
// Multibase: self-describing base encoding (https://github.com/multiformats/multibase)
//   z  → base58btc (Bitcoin-style base58)
//
// Multicodec: self-describing codec prefix (https://github.com/multiformats/multicodec)
//
// These two together let us encode public keys as spec-correct did:key
// identifiers without pulling in the full multiformats dependency tree.

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Encode raw bytes as base58btc (Bitcoin-style) and prefix with "z"
 * per the multibase spec.
 *
 * This is the encoding used by did:key, did:jwk, and W3C
 * publicKeyMultibase fields for Ed25519VerificationKey2020 / Multikey.
 */
export function base58btcEncode(bytes: Uint8Array): string {
  // Count leading zero bytes — each becomes a "1" in the output.
  // Then skip them in the conversion loop so they aren't double-counted
  // (otherwise a zero byte also produces digit 0 → "1").
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) {
    leadingZeros++;
  }

  const body = bytes.slice(leadingZeros);
  if (body.length === 0) return "1".repeat(leadingZeros);

  // Convert non-zero body to big-endian base-58
  const digits: number[] = [0];
  for (const b of body) {
    let carry = b;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  // Leading zeros become "1" prefix characters
  const parts: string[] = new Array(leadingZeros).fill("1");
  for (let i = digits.length - 1; i >= 0; i--) {
    parts.push(BASE58_ALPHABET[digits[i]]);
  }
  return parts.join("");
}

/**
 * Encode raw bytes as multibase base58btc with "z" prefix.
 * This is the canonical `publicKeyMultibase` value.
 */
export function multibaseEncode(bytes: Uint8Array): string {
  return "z" + base58btcEncode(bytes);
}

// ── Multicodec prefixes (unsigned-varint encoded) ──────────────────────────
//
// These are the binary prefixes for each key type, in their unsigned-varint
// encoding as specified by the multicodec table:
//   https://github.com/multiformats/multicodec

/** ed25519-pub → unsigned varint: [0xed, 0x01] */
const ED25519_PUB_PREFIX = new Uint8Array([0xed, 0x01]);

/**
 * Build a did:key identifier from a public key.
 *
 * The identifier is:
 *   did:key:<multibase(multicodec(key_type) || raw_key_bytes)>
 *
 * @param rawKeyBytes - The raw public key bytes (without any prefix)
 * @param multicodecPrefix - The multicodec varint prefix for the key type
 * @returns Full did:key string, e.g. "did:key:z6Mk..."
 */
export function encodeDidKey(
  rawKeyBytes: Uint8Array,
  multicodecPrefix: Uint8Array,
): string {
  const combined = new Uint8Array(multicodecPrefix.length + rawKeyBytes.length);
  combined.set(multicodecPrefix);
  combined.set(rawKeyBytes, multicodecPrefix.length);
  return "did:key:" + multibaseEncode(combined);
}

/** Known multicodec prefixes mapped from JWK crv */
export const MULTICODEC_FROM_CRV: Record<
  string,
  { prefix: Uint8Array; keyType: string }
> = {
  Ed25519: {
    prefix: ED25519_PUB_PREFIX,
    keyType: "Ed25519VerificationKey2020",
  },
};
