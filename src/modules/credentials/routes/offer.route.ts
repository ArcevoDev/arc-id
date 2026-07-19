import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { flowExecutor } from "@/core/flows";
import { createOfferFlow, createAcceptFlow } from "../flows/offer-credential.flow";
import { IssueCredentialSchema } from "../validators/credential.schemas";
import { z } from "zod";

const AcceptOfferParams = z.object({
  token: z.string()
});

export async function offerRoute(fastify: FastifyInstance) {
  const withZod = fastify.withTypeProvider<ZodTypeProvider>();

  withZod.post(
    "/offers",
    {
      preHandler: [
        fastify.auth.requirePlan("PRO"),
        fastify.auth.requirePermission("credential:offer"),
      ],
      schema: {
        tags: ["Verifiable Credentials Engine"],
        summary: "Create a credential offer for a holder (PRO)",
        description:
          "Creates a time-limited credential offer that a holder can " +
          "accept to receive a verifiable credential. Requires PRO subscription " +
          "and credential:offer permission.",
        security: [{ bearerAuth: [] }],
        body: IssueCredentialSchema,
        response: {
          201: z.object({
            success: z.boolean(),
            data: z.object({
              token: z.string(),
              expiresAt: z.string(),
            }),
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(createOfferFlow, req.body, {
        identityId: req.identity.id,
        tenantId: req.identity.tenantId,
        ip: req.ip,
      });
      return reply.status(201).send({ success: true, data: result });
    },
  );

  withZod.post(
    "/offers/:token/accept",
    {
      preHandler: [fastify.auth.requireUser],
      schema: {
        tags: ["Verifiable Credentials Engine"],
        summary: "Accept a credential offer (authenticated user)",
        description:
          "Accepts a pending credential offer, verifies the authenticated " +
          "user's DID matches the offer's subjectDid, and issues the credential. " +
          "Returns 409 if already consumed or expired.",
        security: [{ bearerAuth: [] }],
        params: AcceptOfferParams,
        response: {
          201: z.object({ success: z.boolean(), data: z.any() }),
          409: z.object({
            success: z.boolean(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { token } = req.params as { token: string };
      const result = await flowExecutor.run(createAcceptFlow, { token }, {
        identityId: req.identity.id,
        tenantId: req.identity.tenantId,
        ip: req.ip,
      });
      return reply.status(201).send({ success: true, data: result });
    },
  );
}
