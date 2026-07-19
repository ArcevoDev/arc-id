// src/modules/auth/routes/set-username.route.ts
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { setUsernameFlow } from "../flows/set-username.flow";
import { SetUsernameSchema } from "../validators/auth.schemas";
import { flowExecutor } from "@/core/flows";

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
      preHandler: fastify.auth.requireUser,
    },
    async (request, reply) => {
      const result = await flowExecutor.run(setUsernameFlow, request.body, {
        identityId: request.identity.id,
        tenantId: request.identity.tenantId,
        ip: request.ip,
      });
      return reply.code(200).send(result);
    },
  );
}
