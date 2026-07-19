// src/modules/identity/routes/wallet-did.route.ts
//
// Mounted under /identity/wallet — full path:
//   POST /identity/wallet/did
//
// Registers a user-owned did:key from an ArcWallet-supplied public key JWK.
// Creates the DecentralizedIdentifier + Wallet rows in a single flow.

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { flowExecutor } from "@/core/flows";
import { registerWalletDidFlow } from "../flows/register-wallet-did.flow";
import {
  JwkSchema,
  RegisterWalletDidOutputSchema,
} from "../validators/wallet-did.schemas";

export async function walletDidRoute(fastify: FastifyInstance) {
  const withZod = fastify.withTypeProvider<ZodTypeProvider>();

  // POST /identity/wallet/did
  withZod.post(
    "/wallet/did",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["ArcWallet Integration"],
        summary:
          "Register an identity-owned did:key from a wallet-supplied JWK",
        description:
          "ArcWallet generates a keypair on-device and submits the public key as a JWK. " +
          "ArcID encodes it as a spec-correct did:key (multicodec + multibase), builds the " +
          "DID document, and creates the DecentralizedIdentifier + Wallet rows. " +
          "ArcID never touches the private key.",
        security: [{ bearerAuth: [] }],
        body: z.object({
          publicKeyJwk: JwkSchema,
          provider: z.string().min(1).max(64).default("arcwallet"),
          providerWalletId: z.string().min(1).max(256),
        }),
        response: {
          201: z.object({
            success: z.boolean(),
            data: RegisterWalletDidOutputSchema,
          }),
          400: z.object({
            success: z.boolean(),
            error: z.string(),
            message: z.string(),
          }),
          409: z.object({
            success: z.boolean(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(registerWalletDidFlow, req.body, {
        identityId: req.identity.id,
        tenantId: null,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return reply.status(201).send({
        success: true,
        data: result,
      });
    },
  );
}
