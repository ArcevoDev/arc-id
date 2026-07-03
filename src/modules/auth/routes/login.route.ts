// src/modules/auth/routes/login.route.ts
//
// SWAGGER FIX: response was `data: z.any()` — Swagger had no shape to generate
// an example from. Replaced with the actual typed response shape derived from
// loginFlow's Output type. Conditional fields (accessToken etc.) are .optional()
// because the login flow returns two shapes: MFA-pending and fully authenticated.

import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows";
import { loginFlow } from "../flows/login.flow";
import { LoginSchema, IdentityDtoSchema } from "../validators/auth.schemas";
import { z } from "zod";

// Mirrors loginFlow Output type exactly — keeps Swagger example accurate.
const LoginResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    identity: IdentityDtoSchema,
    sessionId: z.string(),
    requiresMfa: z.boolean(),
    mfaTypes: z.array(z.string()),
    // Present when requiresMfa === false (fully authenticated)
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    idToken: z.string().nullable().optional(),
    expiresIn: z.number().int().optional(),
  }),
});

export async function loginRoute(fastify: FastifyInstance) {
  fastify.post(
    "/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["Authentication"],
        summary: "Authenticate credentials",
        description:
          "Validates email and password. Returns tokens immediately if MFA is not enabled, or a sessionId + requiresMfa:true to trigger MFA verification.",
        body: LoginSchema,
        response: {
          200: LoginResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(
        loginFlow,
        req.body,
        {
          tenantId: null,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        },
        { transaction: false },
      );

      return reply.send({ success: true, data: result });
    },
  );
}
