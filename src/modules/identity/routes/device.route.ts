import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { presentDevice } from "../presenters/device.presenter";

export async function deviceRoute(fastify: FastifyInstance) {
  fastify.get(
    "/devices",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "List verified authentication hardware devices",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(z.any()),
          }),
        },
      },
    },
    async (req, reply) => {
      const devices = await fastify.db.device.findMany({
        where: { identityId: req.identity.id },
      });
      return reply.send({ success: true, data: devices.map(presentDevice) });
    },
  );

  fastify.delete(
    "/devices/:id",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "Revoke device endpoint authorization status",
        security: [{ bearerAuth: [] }],
        params: z.object({
          id: z.string().min(1),
        }),
        response: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      await fastify.db.device.deleteMany({
        where: { id, identityId: req.identity.id },
      });
      return reply.send({ success: true });
    },
  );
}
