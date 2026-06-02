import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { config } from "@/core/config";
import { MfaVerifySchema } from "../validators/auth.schemas";
import { MfaService } from "../services/mfa.service";
import { TokenService } from "@/modules/oauth/services/token.service";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";

type Input = z.infer<typeof MfaVerifySchema>;

type Output = {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  idToken: string | null;
  expiresIn: number;
};

const DEFAULT_SCOPES = ["openid", "profile", "email", "offline_access"];

export const mfaVerifyFlow: Flow<Input, Output> = {
  name: "auth:mfa-verify",
  inputSchema: MfaVerifySchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    const mfaService = new MfaService(ctx.db);
    const tokenService = new TokenService();

    // Grab client target identifier cleanly out of the validated configuration instance
    const targetClientId = config.oauth.directClientId;

    // 1. Load the pending session
    const session = await ctx.db.session.findFirst({
      where: { id: input.sessionId, expiresAt: { gt: new Date() } },
      include: {
        identity: {
          include: { mfas: { where: { enabled: true } } },
        },
      },
    });

    if (!session) {
      throw ApiError.unauthorized("Session not found or expired");
    }

    // 2. Validate TOTP state availability
    const totpMfa = session.identity.mfas.find((m) => m.type === "TOTP");
    if (!totpMfa?.secret) {
      throw ApiError.badRequest("No active TOTP configured");
    }

    // 3. Cryptographic time-step verification
    const valid = mfaService.verifyTotp(totpMfa.secret, input.code);
    if (!valid) {
      throw ApiError.unauthorized("Invalid MFA code");
    }

    // 4. Promote session to valid (MFA Challenge Passed)
    await ctx.db.session.update({
      where: { id: session.id },
      data: { valid: true },
    });

    // 5. Issue secure tokens bound to the authenticated session context
    const tokens = await tokenService.issue(ctx, {
      identityId: session.identityId,
      clientId: targetClientId,
      sessionId: session.id,
      scopes: DEFAULT_SCOPES,
      audience: [targetClientId],
      tenantId: ctx.tenantId,
    });

    auditService.log({
      action: "USER_LOGIN_SUCCESS",
      identityId: session.identityId,
      ip: ctx.ip,
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
