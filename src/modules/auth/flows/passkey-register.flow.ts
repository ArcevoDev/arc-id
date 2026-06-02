import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { PasskeyService } from "../services/passkey.service";

const PasskeyRegisterSchema = z.object({
  response: z.record(z.string(), z.unknown()),
  challenge: z.string(),
});

export const passkeyRegisterFlow: Flow<z.infer<typeof PasskeyRegisterSchema>> =
  {
    name: "auth:passkey-register",
    inputSchema: PasskeyRegisterSchema,

    async execute(input, ctx: FlowContext) {
      if (!ctx.userId) throw new Error("userId required");
      const service = new PasskeyService(ctx.db);
      return service.verifyRegistration(
        ctx.userId,
        input.response,
        input.challenge,
      );
    },
  };
