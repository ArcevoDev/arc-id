// src/modules/auth/flows/passkey-authenticate.flow.ts
import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { PasskeyService } from "../services/passkey.service";
import { SessionService } from "../services/session.service";
import { TokenService } from "@/modules/oauth/services/token.service";
import { ApiError } from "@/core/errors/api-error";
import { config } from "@/core/config";

const PasskeyAuthSchema = z.object({
  response: z.record(z.string(), z.unknown()),
  challenge: z.string(),
});

type Output = {
  sessionId: string;
  identityId: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string | null;
  expiresIn?: number;
};

const DEFAULT_SCOPES = ["openid", "profile", "email", "offline_access"];

export const passkeyAuthenticateFlow: Flow<z.infer<typeof PasskeyAuthSchema>, Output> = {
  name: "auth:passkey-authenticate",
  inputSchema: PasskeyAuthSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    const passkeyService = new PasskeyService(ctx.db);
    const sessionService = new SessionService(ctx.db);

    const { verified, passkey } = await passkeyService.verifyAuthentication(
      input.response,
      input.challenge,
    );
    if (!verified || !passkey) {
      throw ApiError.unauthorized("Passkey verification failed");
    }

    const { session } = await sessionService.create({
      identityId: passkey.identityId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    let tokens = null;
    const targetClientId = config.oauth.directClientId;
    
    if (targetClientId) {
      const tokenService = new TokenService();
      tokens = await tokenService.issue(ctx, {
        identityId: passkey.identityId,
        clientId: targetClientId,
        sessionId: session.id,
        scopes: DEFAULT_SCOPES,
        audience: [targetClientId],
        tenantId: ctx.tenantId || "SYSTEM",
      });
    }

    return {
      sessionId: session.id,
      identityId: passkey.identityId,
      accessToken: tokens?.accessToken,
      refreshToken: tokens?.refreshToken,
      idToken: tokens?.idToken,
      expiresIn: tokens?.expiresIn,
    };
  },
};