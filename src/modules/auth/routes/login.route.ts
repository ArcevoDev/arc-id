import type { FastifyInstance } from "fastify";
import { flowExecutor } from "@/core/flows/flow-executor";
import { loginFlow } from "../flows/login.flow";
import { z } from "zod";

// Assuming you have a standard LoginSchema defined in auth.schemas.ts
// Replace with the exact schema import if named differently
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
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
          "Validates email and password, returning active identity contexts or prompting an MFA verification stage.",
        body: LoginSchema,
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.any(), // Flex signature depending on whether MFA challenge is required
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(loginFlow, req.body, {
        tenantId: null,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return reply.send({ success: true, data: result });
    },
  );
}
