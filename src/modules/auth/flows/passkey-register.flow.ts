// src/modules/auth/flows/passkey-register.flow.ts
import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { PasskeyService } from "../services/passkey.service";
import { ApiError } from "@/core/errors/api-error";

const PasskeyRegisterSchema = z.object({
  response: z.record(z.string(), z.unknown()),
  challenge: z.string(),
});

type Output = {
  verified: boolean;
};

export const passkeyRegisterFlow: Flow<z.infer<typeof PasskeyRegisterSchema>, Output> = {
  name: "auth:passkey-register",
  inputSchema: PasskeyRegisterSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    if (!ctx.userId) throw ApiError.unauthorized("Authentication required to register passkeys");
    
    const service = new PasskeyService(ctx.db);
    return await service.verifyRegistration(
      ctx.userId,
      input.response,
      input.challenge,
    );
  },
};