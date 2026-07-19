// src/modules/identity/validators/wallet-did.schemas.ts
import { z } from "zod";
import type { KeyType } from "@prisma-client";

/**
 * A JWK as produced by Web Crypto API (OKP Ed25519, EC P-256, etc.).
 * ArcWallet generates the key on-device and submits the public key only.
 */
export const JwkSchema = z.object({
  kty: z.enum(["OKP", "EC", "RSA"]),
  crv: z.string().min(1, "crv is required"),
  x: z.string().min(1, "x (base64url) is required"),
  y: z.string().optional(),
  alg: z.string().optional(),
});

export const RegisterWalletDidInputSchema = z.object({
  /** JWK representing the public key — generated on-device by ArcWallet */
  publicKeyJwk: JwkSchema,
  /** Provider name, e.g. "arcwallet" */
  provider: z.string().min(1).max(64).default("arcwallet"),
  /** Provider's wallet identifier for this user — opaque to ArcID */
  providerWalletId: z.string().min(1).max(256),
});

export type RegisterWalletDidInput = z.infer<
  typeof RegisterWalletDidInputSchema
>;

export const RegisterWalletDidOutputSchema = z.object({
  did: z.string(),
  didDocument: z.record(z.string(), z.unknown()),
  walletId: z.string(),
  keyType: z.string(),
});

export type RegisterWalletDidOutput = z.infer<
  typeof RegisterWalletDidOutputSchema
>;
