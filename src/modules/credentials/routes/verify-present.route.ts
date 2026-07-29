import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import crypto from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/core/errors/api-error";
import { flowExecutor } from "@/core/flows";
import { verifyCredentialFlow } from "../flows/verify-credential.flow";
import { verifyDetachedJws } from "@/lib/security/jws-proof";
import { decodeProtectedHeader } from "jose";

const PresentBodySchema = z.object({
  sessionId: z.string(),
  credential: z.string(),
  proof: z.string(),
});

const PresentValidResponse = z.object({
  valid: z.literal(true),
  claims: z.record(z.string(), z.unknown()),
  sessionId: z.string(),
});

const PresentInvalidResponse = z.object({
  valid: z.literal(false),
  reason: z.string(),
});

export async function verifyPresentRoute(fastify: FastifyInstance) {
  const withZod = fastify.withTypeProvider<ZodTypeProvider>();

  withZod.post(
    "/verify/present",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Verifiable Credentials Engine"],
        summary: "Present a credential for verification",
        description:
          "Accepts a credential proof bound to a verification session challenge. " +
          "Verifies the detached JWS proof, checks credential validity (signature, expiry, revocation), " +
          "and marks the session as consumed on success. No authentication required.",
        body: PresentBodySchema,
        response: {
          200: z.union([PresentValidResponse, PresentInvalidResponse]),
        },
      },
    },
    async (req, reply) => {
      const { sessionId, credential, proof } = req.body;

      // ── 1. Load session ─────────────────────────────────────────────────────
      const session = await fastify.db.verifySession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          challenge: true,
          status: true,
          expiresAt: true,
        },
      });

      if (!session) {
        throw ApiError.notFound("Verification session not found");
      }

      const status = session.status;
      if (status === "CONSUMED" || status === "EXPIRED" || session.expiresAt < new Date()) {
        throw new ApiError(
          "Verification session has expired or been consumed",
          410,
          "GONE",
        );
      }

      // ── 2. Verify detached JWS proof ────────────────────────────────────────
      let kid: string;
      try {
        const header = decodeProtectedHeader(proof) as Record<string, unknown>;
        kid = (header.kid as string) ?? "";
      } catch {
        return reply.send({ valid: false, reason: "invalid_proof" });
      }

      const didKey = kid.split("#")[0];
      if (!didKey) {
        return reply.send({ valid: false, reason: "invalid_proof" });
      }

      const credentialHash = crypto
        .createHash("sha256")
        .update(credential)
        .digest("base64url");

      const proofValid = await verifyDetachedJws(
        proof,
        session.challenge,
        credentialHash,
        didKey,
        fastify.db,
      );

      if (!proofValid) {
        return reply.send({ valid: false, reason: "invalid_proof" });
      }

      // ── 3. Verify credential (signature, expiry, revocation) ────────────────
      const verifyResult = await flowExecutor.run(
        verifyCredentialFlow,
        { credential },
        { tenantId: null },
        { transaction: false },
      );

      if (!verifyResult.valid) {
        return reply.send({
          valid: false,
          reason: verifyResult.reason ?? "verification_failed",
        });
      }

      // ── 4. Mark session consumed ────────────────────────────────────────────
      await fastify.db.verifySession.update({
        where: { id: sessionId },
        data: { status: "CONSUMED" },
      });

      return reply.send({
        valid: true as const,
        claims: verifyResult.claims ?? {},
        sessionId: session.id,
      });
    },
  );
}
