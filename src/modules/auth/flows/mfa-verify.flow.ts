import { z } from "zod";
import type { FlowContext, Flow } from "@/core/flows";
import { MfaVerifySchema } from "../validators/auth.schemas";
import { MfaService } from "../services/mfa.service";
import { TokenService } from "@/modules/oauth/services/token.service";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { config } from "@/core/config";

type Input = z.infer<typeof MfaVerifySchema>;
type Output = {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string | null;
  expiresIn?: number;
};

const DEFAULT_SCOPES = ["openid", "profile", "email", "offline_access"];

export const mfaVerifyFlow: Flow<Input, Output> = {
  name: "auth:mfa-verify",
  inputSchema: MfaVerifySchema,
  async execute(input, ctx: FlowContext): Promise<Output> {
    const mfaService = new MfaService(ctx.db);

    // Retrieve the locked session metadata mapping securely
    const session = await ctx.db.session.findUnique({
      where: { id: input.sessionId },
      include: { identity: true },
    });

    if (!session) {
      throw ApiError.notFound("Target authentication session context not found");
    }

    // Execute cryptographic signature verification logic over active tokens
    const verified = await mfaService.verifyTotp(session.identityId, input.code);
    if (!verified) {
      await auditService.log({
        action: "MFA_VERIFICATION_FAILED",
        identityId: session.identityId,
        ip: ctx.ip,
      });
      throw ApiError.unauthorized("Invalid multi-factor verification token payload");
    }

    // Reactivate session inside transaction context cleanly
    await ctx.db.session.update({
      where: { id: session.id },
      data: { valid: true },
    });

    let tokens = null;
    const targetClientId = config.oauth.directClientId;

    if (targetClientId) {
      const tokenService = new TokenService();
      tokens = await tokenService.issue(ctx, {
        identityId: session.identityId,
        clientId: targetClientId,
        sessionId: session.id,
        scopes: DEFAULT_SCOPES,
        audience: [targetClientId],
        tenantId: ctx.tenantId,
      });
    }

    await auditService.log({
      action: "MFA_VERIFICATION_SUCCESS",
      identityId: session.identityId,
      ip: ctx.ip,
    });

    return {
      success: true,
      accessToken: tokens?.accessToken,
      refreshToken: tokens?.refreshToken,
      idToken: tokens?.idToken,
      expiresIn: tokens?.expiresIn,
    };
  },
};