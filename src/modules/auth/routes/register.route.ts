import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { registerFlow } from "../flows/register.flow"; // 👈 Fixed path string target
import { RegisterSchema, IdentityDtoSchema } from "../validators/auth.schemas";
import { z } from "zod";

export async function registerRoute(fastify: FastifyInstance) {
  fastify.post(
    "/register",
    {
      schema: {
        tags: ["Authentication Architecture"],
        summary: "Register a fresh sovereign digital identity space",
        description:
          "Atomically creates a baseline Identity tracking context and local secure account credential vector inside a unified transaction shell.",
        body: RegisterSchema,
        response: {
          201: z.object({
            success: z.boolean(),
            data: z.object({
              identity: IdentityDtoSchema, // 👈 Shared, reusable structural DTO mapping contract
            }),
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(registerFlow, req.body, {
        tenantId: null,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // Pass the flow results out cleanly. The DTO will map and sanitize fields automatically.
      return reply.status(201).send({
        success: true,
        data: {
          identity: result.identity,
        },
      });
    },
  );
}
