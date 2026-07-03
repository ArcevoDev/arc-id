// src/modules/auth/flows/mfa-verify.flow.ts
import { z } from "zod";
import type { FlowContext, Flow } from "@/core/flows";
import { MfaVerifySchema } from "../validators/auth.schemas";
import { MfaService } from "../services/mfa.service";
import { SessionService } from "../services/session.service";
import { TokenService } from "@/modules/oauth/services/token.service";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { config } from "@/core/config";

type Input = z.infer<typeof MfaVerifySchema>;

type Output = {
  sessionId: string;
  identityId: string;
  accessToken: string;
  refreshToken: string;
  idToken: string | null;
  expiresIn: number;
  authLevel: "aal1" | "aal2";
};

const DEFAULT_SCOPES = ["openid", "profile", "email", "offline_access"];

export const mfaVerifyFlow: Flow<Input, Output> = {
  name: "auth:mfa-verify",
  inputSchema: MfaVerifySchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    // ctx.db may be a transaction client (injected by mfa.route.ts) or the
    // raw Prisma client. Either way, we use it consistently throughout.
    const mfaService = new MfaService(ctx.db);

    // ── Step 1: Validate session ───────────────────────────────────────────────
    const session = await ctx.db.session.findUnique({
      where: { id: input.sessionId },
      include: { identity: true },
    });

    if (!session) {
      throw ApiError.notFound("Authentication session not found");
    }

    if (!session.valid) {
      throw ApiError.unauthorized("Session is no longer valid");
    }

    // ── Step 2: Retrieve active TOTP configuration ─────────────────────────────
    const mfa = await ctx.db.mfa.findFirst({
      where: {
        identityId: session.identityId,
        type: "TOTP",
        enabled: true,
      },
    });

    if (!mfa?.secret) {
      throw ApiError.badRequest("No active MFA configuration found");
    }

    // ── Step 3: Verify the TOTP code (pure CPU — no DB access) ────────────────
    const verified = await mfaService.verifyTotp(mfa.secret, input.code);

    if (!verified) {
      // Failure audit — fire-and-forget on its own connection (not ctx.db).
      void auditService
        .log({
          action: "MFA_VERIFICATION_FAILED",
          identityId: session.identityId,
          ip: ctx.ip,
        })
        .catch(() => {});

      throw ApiError.unauthorized("Invalid MFA verification code");
    }

    // ── Step 4 + 5: Atomic — promote session to aal2 AND issue tokens ─────────
    const sessionService = new SessionService(ctx.db);
    await sessionService.promoteToAal2(session.id);

    let tokens: any = null;
    const targetClientId = config.oauth.directClientId;

    if (targetClientId) {
      const tokenService = new TokenService();
      tokens = await tokenService.issue(ctx, {
        identityId: session.identityId,
        clientId: targetClientId,
        sessionId: session.id,
        scopes: DEFAULT_SCOPES,
        audience: [targetClientId],
        tenantId: ctx.tenantId ?? "SYSTEM",
        authLevel: "aal2",
      });
    }

    if (!tokens) {
      throw ApiError.internal(
        "Failed to issue tokens for authenticated session",
      );
    }

    // ── Step 6: Success audit (fire-and-forget, outside the transaction) ───────
    void auditService
      .log({
        action: "MFA_VERIFICATION_SUCCESS",
        identityId: session.identityId,
        ip: ctx.ip,
      })
      .catch(() => {});

    return {
      sessionId: session.id,
      identityId: session.identityId, // Fixed reference from passkey.identityId
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      expiresIn: tokens.expiresIn,
      authLevel: "aal2",
    };
  },
};
