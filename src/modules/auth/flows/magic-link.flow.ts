// src/modules/auth/flows/magic-link.flow.ts
import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { EmailTokenService } from "../services/email-token.service";
import { SessionService } from "../services/session.service";
import { TokenService } from "@/modules/oauth/services/token.service";
import { ApiError } from "@/core/errors/api-error";
import { config } from "@/core/config";

const MagicLinkSchema = z.object({ token: z.string().min(1) });

type Output = {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  idToken: string | null;
  expiresIn: number;
};

const DEFAULT_SCOPES = ["openid", "profile", "email", "offline_access"];

export const magicLinkFlow: Flow<z.infer<typeof MagicLinkSchema>, Output> = {
  name: "auth:magic-link",
  inputSchema: MagicLinkSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    const emailTokenService = new EmailTokenService(ctx.db);
    const tokenRecord = await emailTokenService.consume(
      input.token,
      "MAGIC_LINK",
    );

    const identity = await ctx.db.identity.findUniqueOrThrow({
      where: { id: tokenRecord.identityId },
    });

    if (identity.status === "BANNED" || identity.status === "SUSPENDED") {
      throw ApiError.forbidden("Account is not active");
    }

    const sessionService = new SessionService(ctx.db);
    const { session } = await sessionService.create({
      identityId: identity.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      authLevel: "aal1",
    });

    const tokenService = new TokenService();
    const tokens = await tokenService.issue(ctx, {
      identityId: identity.id,
      clientId: config.oauth.directClientId,
      sessionId: session.id,
      scopes: DEFAULT_SCOPES,
      audience: [config.oauth.directClientId],
      tenantId: ctx.tenantId || "SYSTEM",
      authLevel: "aal1",
    });

    return {
      sessionId: session.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      expiresIn: tokens.expiresIn,
    };
  },
};
