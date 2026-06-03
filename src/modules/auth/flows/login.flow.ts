import { z } from "zod";
import type { FlowContext, Flow } from "@/core/flows";
import { LoginSchema } from "../validators/auth.schemas";
import { IdentityRepository } from "../repositories/identity.repository";
import { SessionService } from "../services/session.service";
import { verifyPassword } from "../services/password.service";
import { TokenService } from "@/modules/oauth/services/token.service";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { presentIdentity } from "../presenters/identity.presenter";
import { notificationService } from "@/lib/notifications/notification.service";
import { config } from "@/core/config";

type Input = z.infer<typeof LoginSchema>;
type Output = {
  identity: ReturnType<typeof presentIdentity>;
  sessionId: string;
  requiresMfa: boolean;
  mfaTypes: string[];
  accessToken?: string;
  refreshToken?: string;
  idToken?: string | null;
  expiresIn?: number;
};

const DEFAULT_SCOPES = ["openid", "profile", "email", "offline_access"];

export const loginFlow: Flow<Input, Output> = {
  name: "auth:login",
  inputSchema: LoginSchema,
  async execute(input, ctx: FlowContext): Promise<Output> {
    const identityRepo = new IdentityRepository(ctx.db);
    const sessionService = new SessionService(ctx.db);
    const targetClientId = config.oauth.directClientId;

    const identity = await identityRepo.findForAuth(input.email);

    if (!identity?.localAccount) {
      await auditService.log({ action: "USER_LOGIN_FAILED", ip: ctx.ip });
      throw ApiError.unauthorized("Invalid email or password");
    }

    if (identity.status === "BANNED") throw ApiError.forbidden("Account banned");
    if (identity.status === "SUSPENDED") throw ApiError.forbidden("Account suspended");
    if (identity.status === "DELETED") throw ApiError.unauthorized("Invalid email");

    const valid = await verifyPassword(
      identity.localAccount.passwordHash,
      input.password,
    );

    if (!valid) {
      await auditService.log({
        action: "USER_LOGIN_FAILED",
        identityId: identity.id,
        ip: ctx.ip,
      });
      throw ApiError.unauthorized("Invalid email or password");
    }

    // Invoke clean, decoupled Session service
    const { session } = await sessionService.create({
      identityId: identity.id,
      localAccountId: identity.localAccount.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    const activeMfas = identity.mfas.filter((m) => m.enabled);
    if (activeMfas.length > 0) {
      // Intentionally disable session validity flag until step-up token execution resolves successfully
      await ctx.db.session.update({
        where: { id: session.id },
        data: { valid: false },
      });

      await auditService.log({
        action: "SESSION_CREATED",
        identityId: identity.id,
        ip: ctx.ip,
      });

      return {
        identity: presentIdentity(identity),
        sessionId: session.id,
        requiresMfa: true,
        mfaTypes: activeMfas.map((m) => m.type),
      };
    }

    let tokens = null;
    if (targetClientId) {
      const tokenService = new TokenService();
      tokens = await tokenService.issue(ctx, {
        identityId: identity.id,
        clientId: targetClientId,
        sessionId: session.id,
        scopes: DEFAULT_SCOPES,
        audience: [targetClientId],
        tenantId: ctx.tenantId,
      });
    }

    void Promise.all([
      auditService.log({
        action: "USER_LOGIN_SUCCESS",
        identityId: identity.id,
        ip: ctx.ip ?? "0.0.0.0",
      }),
      notificationService.sendNewDeviceLogin(
        identity.primaryEmail ?? "unknown@arcid.local",
        {
          ip: ctx.ip ?? "0.0.0.0",
          userAgent: ctx.userAgent ?? "Unknown User Agent",
        },
      ),
    ]);

    return {
      identity: presentIdentity(identity),
      sessionId: session.id,
      requiresMfa: false,
      mfaTypes: [],
      accessToken: tokens?.accessToken,
      refreshToken: tokens?.refreshToken,
      idToken: tokens?.idToken,
      expiresIn: tokens?.expiresIn,
    };
  },
};