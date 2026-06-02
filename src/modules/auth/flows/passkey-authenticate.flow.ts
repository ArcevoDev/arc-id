import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { PasskeyService } from "../services/passkey.service";
import { SessionService } from "../services/session.service";
import { ApiError } from "@/core/errors/api-error";

const PasskeyAuthSchema = z.object({
  response: z.record(z.string(), z.unknown()),
  challenge: z.string(),
});

export const passkeyAuthenticateFlow: Flow<z.infer<typeof PasskeyAuthSchema>> =
  {
    name: "auth:passkey-authenticate",
    inputSchema: PasskeyAuthSchema,

    async execute(input, ctx: FlowContext) {
      const passkeyService = new PasskeyService(ctx.db);
      const sessionService = new SessionService(ctx.db);

      const { verified, passkey } = await passkeyService.verifyAuthentication(
        input.response,
        input.challenge,
      );
      if (!verified || !passkey)
        throw ApiError.unauthorized("Passkey verification failed");

      const { session } = await sessionService.create({
        identityId: passkey.identityId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });

      // TODO: issue access + refresh tokens
      return { sessionId: session.id, identityId: passkey.identityId };
    },
  };
