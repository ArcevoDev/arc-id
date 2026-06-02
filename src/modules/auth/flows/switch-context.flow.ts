import { z } from "zod";
import type { FlowContext, Flow } from "@/core/flows";
import { ApiError } from "@/core/errors/api-error";
import { TokenService } from "@/modules/oauth/services/token.service";
import { config } from "@/core/config";
import { SwitchContextSchema } from "../validators/auth.schemas";

// Define the output structure matching your login flow
type Output = {
  accessToken: string;
  refreshToken: string;
  idToken: string | null;
  expiresIn: number;
};

export const switchContextFlow: Flow<
  z.infer<typeof SwitchContextSchema>,
  Output
> = {
  name: "auth:switch-context",
  inputSchema: SwitchContextSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    if (!ctx.userId) throw ApiError.unauthorized("Not logged in");

    const membership = await ctx.db.tenantMembership.findFirst({
      where: {
        identityId: ctx.userId,
        tenantId: input.tenantId,
        status: "ACTIVE",
      },
    });

    if (!membership) throw ApiError.forbidden("No access to this tenant");

    const tokenService = new TokenService();
    // Assuming ctx.metadata contains the active sessionId from the login session
    const sessionId = (ctx.metadata?.sessionId as string) || ctx.sessionId;

    if (!sessionId) throw ApiError.unauthorized("No active session found");

    return await tokenService.issue(ctx, {
      identityId: ctx.userId,
      clientId: config.oauth.directClientId,
      sessionId,
      tenantId: input.tenantId,
      scopes: ["openid", "profile", "email", "offline_access"],
      audience: [config.oauth.directClientId],
    });
  },
};
