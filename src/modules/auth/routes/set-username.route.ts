// src/modules/auth/routes/set-username.route.ts
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { setUsernameFlow } from "../flows/set-username.flow";
import { SetUsernameSchema } from "../validators/auth.schemas";
import { FlowExecutor } from "@/core/flows";

export async function setUsernameRoute(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.patch(
    "/username",
    {
      schema: {
        body: SetUsernameSchema,
        tags: ["auth"],
        summary: "Set or update the authenticated user's username",
      },
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const result = await FlowExecutor.execute(setUsernameFlow, request.body, {
        db: fastify.db,
        identityId: request.identity.id,
        ip: request.ip,
        tenantId: request.identity.tenantId ?? null,
        requestId: request.id,
      });
      return reply.code(200).send(result);
    },
  );
}
