import type { FastifyInstance } from "fastify";
import { z } from "zod";

const WebhookIncomingSchema = z.object({
  eventType: z.string(),
  identityId: z.string(),
  payload: z.any(),
});

export async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/arcid", // Placed under a /webhooks prefix inside server registration
    {
      schema: {
        tags: ["System Webhooks Engine"],
        summary:
          "Ingest internal notification and ecosystem state synchronization signals",
        body: WebhookIncomingSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            received: z.boolean(),
          }),
        },
      },
    },
    async (req, reply) => {
      const { eventType, identityId, payload } = req.body as z.infer<
        typeof WebhookIncomingSchema
      >;

      fastify.log.info(
        `[WEBHOOK_RECEIVER] Signal ingested safely. Event: ${eventType} | Identity Context: ${identityId}`,
      );

      // Perform processing or cross-workspace notifications here...

      return reply.status(200).send({
        success: true,
        received: true,
      });
    },
  );
}
