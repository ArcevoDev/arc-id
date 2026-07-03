// src/modules/auth/routes/register.route.ts
//
// FIX: added per-route rate limit.
// Previous version had none — inherited global 200/min which is far too
// generous for account creation (enables bulk account farming).
// 5 registrations per hour per IP is a sensible ceiling for legitimate use.
import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows";
import { registerFlow } from "../flows/register.flow";
import { RegisterSchema, IdentityDtoSchema } from "../validators/auth.schemas";
import { z } from "zod";

export async function registerRoute(fastify: FastifyInstance) {
  fastify.post(
    "/register",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 hour",
        },
      },
      schema: {
        tags: ["Authentication"],
        summary: "Register a new identity",
        description:
          "Creates an Identity and LocalAccount atomically. Sends an email verification link. " +
          "The identity starts as PENDING until the email is verified.",
        body: RegisterSchema,
        response: {
          201: z.object({
            success: z.boolean(),
            data: z.object({ identity: IdentityDtoSchema }),
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

      return reply.status(201).send({
        success: true,
        data: { identity: result.identity },
      });
    },
  );
}
