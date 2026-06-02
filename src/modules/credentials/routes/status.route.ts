import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config } from "@/core/config";
import { z } from "zod";

interface StatusListParams {
  id: string;
}

export async function statusRoute(fastify: FastifyInstance) {
  fastify.get(
    "/status-lists/:id",
    {
      schema: {
        tags: ["Verifiable Credentials Engine"],
        summary: "Resolve W3C Bitstring Status List vector",
        description:
          "Public unauthenticated endpoint used by external verifiers to fetch high-performance binary validation arrays.",
        params: z.object({
          id: z
            .string()
            .min(1, "Status list identifier tracking index parameter required"),
        }),
        response: {
          200: z.object({
            "@context": z.array(z.string()),
            id: z.string(),
            type: z.array(z.string()),
            credentialSubject: z.object({
              id: z.string(),
              type: z.string(),
              statusPurpose: z.string(),
              encodedList: z.string(),
            }),
          }),
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: StatusListParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = req.params;

      const list = await fastify.db.bitstringStatusList.findUnique({
        where: { id },
      });

      if (!list) {
        return reply.status(404).send({ error: "NOT_FOUND" });
      }

      const apiBase = config.base.apiUrl;

      return reply.send({
        "@context": [
          "https://www.w3.org/2018/credentials/v1",
          "https://w3id.org/vc/status-list/2021/v1",
        ],
        id: `${apiBase}/credentials/status-lists/${id}`,
        type: ["VerifiableCredential", "BitstringStatusListCredential"],
        credentialSubject: {
          id: `${apiBase}/credentials/status-lists/${id}#list`,
          type: "BitstringStatusList",
          statusPurpose: list.statusPurpose.toLowerCase(),
          encodedList: Buffer.from(list.encodedList).toString("base64url"),
        },
      });
    },
  );
}
