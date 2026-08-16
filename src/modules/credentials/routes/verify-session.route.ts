import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import crypto from "node:crypto";
import { z } from "zod";

const CreateSessionSchema = z.object({
  credentialRef: z.string().optional(),
});

export const CreateSessionResponse = z.object({
  sessionId: z.string(),
  challenge: z.string(),
  expiresAt: z.string(),
});

export async function verifySessionRoute(fastify: FastifyInstance) {
  const withZod = fastify.withTypeProvider<ZodTypeProvider>();

  withZod.post(
    "/verify/session",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Verifiable Credentials Engine"],
        summary: "Create a verification session for presentation",
        description:
          "Creates a short-lived verification session with a cryptographic challenge " +
          "that a holder must sign to prove control of their DID. No authentication required.",
        body: CreateSessionSchema,
        response: {
          201: CreateSessionResponse,
        },
      },
    },
    async (req, reply) => {
      const body = req.body;
      const challenge = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const session = await fastify.db.verifySession.create({
        data: {
          challenge,
          credentialRef: body.credentialRef ?? null,
          status: "PENDING",
          expiresAt,
        },
        select: {
          id: true,
          challenge: true,
          expiresAt: true,
        },
      });

      return reply.status(201).send({
        sessionId: session.id,
        challenge: session.challenge,
        expiresAt: session.expiresAt.toISOString(),
      });
    },
  );
}
