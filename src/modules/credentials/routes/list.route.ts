// src/modules/credentials/routes/list.route.ts
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { flowExecutor } from "@/core/flows";
import { listCredentialsFlow } from "../flows/list-credentials.flow";

const CredentialResponse = z.object({
  id: z.string(),
  format: z.string(),
  issuerDid: z.string(),
  subjectDid: z.string(),
  issuedAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable(),
  credentialSubject: z.record(z.string(), z.unknown()),
});

export async function listRoute(fastify: FastifyInstance) {
  const withZod = fastify.withTypeProvider<ZodTypeProvider>();

  withZod.get(
    "/",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Verifiable Credentials Engine"],
        summary: "List credentials held by the authenticated identity",
        description:
          "Returns all Verifiable Credentials where the caller is the holder. " +
          "Each credential is presented with its metadata, issuer, subject, and claims.",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.literal(true),
            data: z.array(CredentialResponse),
          }),
        },
      },
    },
    async (req, reply) => {
      const data = await flowExecutor.run(listCredentialsFlow, {}, {
        identityId: req.identity.id,
        tenantId: req.identity.tenantId,
      });
      return reply.send({ success: true as const, data: data as unknown as z.infer<typeof CredentialResponse>[] });
    },
  );
}
