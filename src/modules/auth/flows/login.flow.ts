// src/modules/auth/flows/login.flow.ts
import { z } from "zod";
import type { FlowContext, Flow } from "@/core/flows";
import { LoginSchema } from "../validators/auth.schemas";
import { IdentityRepository } from "../repositories/identity.repository";
import { SessionService } from "../services/session.service";
import { verifyPassword } from "../services/password.service";
import { TokenService } from "@/modules/oauth/services/token.service";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";
import { presentIdentity } from "../presenters/identity.presenter";
import { notificationService } from "@/lib/notifications/notification.service";
import { config } from "@/core/config";
import { prisma } from "@/core/db";
import {
  checkLockout,
  recordFailure,
  clearAttempts,
} from "@/lib/security/login-attempt";

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
    // ── Step 1: Per-email lockout check ──────────────────────────────────────
    // Checked BEFORE querying the DB or verifying the password.
    //
    // WHY HERE (not on the route):
    //   The route-level rate limit (10 req/min per IP) blocks rapid attacks
    //   from one IP. This check blocks credential stuffing where an attacker
    //   rotating IPs but hammers the same email. The lock is on the account,
    //   not the IP, so IP rotation provides no benefit.
    //
    // TIMING ORACLE PREVENTION:
    //   We return the same "Invalid email or password" error regardless of
    //   whether the lockout fired, the email doesn't exist, or the password
    //   is wrong. The lockout error is identical in shape to the auth failure.
    //   An attacker learns nothing new from the lockout — they already know
    //   they've exceeded the attempt count.
    const lockout = await checkLockout(input.email);
    if (lockout.locked) {
      void auditService
        .log({
          action: "USER_LOGIN_FAILED",
          ip: ctx.ip,
          metadata: { reason: "lockout" },
        })
        .catch(() => {});
      // Same message as bad password — don't confirm the account exists
      throw ApiError.unauthorized("Invalid email or password");
    }

    // ── Step 2: Resolve identity ──────────────────────────────────────────────
    const identityRepo = new IdentityRepository(ctx.db);
    const identity = await identityRepo.findForAuth(input.email);

    if (!identity?.localAccount) {
      // Don't record a failure for non-existent emails — that would let
      // attackers use the lockout to enumerate valid accounts via DoS.
      void auditService
        .log({ action: "USER_LOGIN_FAILED", ip: ctx.ip })
        .catch(() => {});
      throw ApiError.unauthorized("Invalid email or password");
    }

    const validLocalAccount = identity.localAccount;

    if (identity.status === "BANNED")
      throw ApiError.forbidden("Account banned");
    if (identity.status === "SUSPENDED")
      throw ApiError.forbidden("Account suspended");
    if (identity.status === "DELETED")
      throw ApiError.unauthorized("Invalid email");

    // ── Step 3: Password verification ─────────────────────────────────────────
    const valid = await verifyPassword(
      validLocalAccount.passwordHash,
      input.password,
    );

    if (!valid) {
      // Record the failure AFTER confirming the account exists.
      // We don't record for unknown emails (step 2 above) to avoid
      // letting attackers lock out accounts they haven't confirmed exist.
      await recordFailure(input.email);

      void auditService
        .log({
          action: "USER_LOGIN_FAILED",
          identityId: identity.id,
          ip: ctx.ip,
        })
        .catch(() => {});

      throw ApiError.unauthorized("Invalid email or password");
    }

    // ── Step 4: Clear the failure counter on success ───────────────────────────
    // Fire-and-forget — don't delay the login response for Redis.
    void clearAttempts(input.email).catch(() => {});

    // ── Step 5: Session  token issuance (Optimized) ───────────────────────────
    const targetClientId = config.oauth.directClientId;
    const activeMfas = identity.mfas.filter((m) => m.enabled);
    const requiresMfa = activeMfas.length > 0;

    // A. Perform the isolated DB state mutations inside a light transaction block.
    // This resolves the pg connection sharing deprecation warning by keeping
    // complex nested dependencies (like token services) out of the transaction pool.
    const session = await (prisma as any).$transaction(
      async (tx: any) => {
        const sessionService = new SessionService(tx);

        const { session: newSession } = await sessionService.create({
          identityId: identity.id,
          localAccountId: validLocalAccount.id,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          authLevel: "aal1",
        });

        if (requiresMfa) {
          // MFA required — session starts as invalid until MFA is completed.
          return await tx.session.update({
            where: { id: newSession.id },
            data: { valid: false },
          });
        }

        return newSession;
      },
      { timeout: 5000 },
    );

    // B. Issue OpenID Connect tokens outside the database transaction boundary.
    let tokens = null;
    if (!requiresMfa && targetClientId) {
      const tokenService = new TokenService();
      tokens = await tokenService.issue(
        { ...ctx, db: prisma },
        {
          identityId: identity.id,
          clientId: targetClientId,
          sessionId: session.id,
          scopes: DEFAULT_SCOPES,
          audience: [targetClientId],
          tenantId: ctx.tenantId,
          authLevel: "aal1",
        },
      );
    }

    // ── Step 6: Response ──────────────────────────────────────────────────────
    if (requiresMfa) {
      void auditService
        .log({ action: "SESSION_CREATED", identityId: identity.id, ip: ctx.ip })
        .catch(() => {});

      return {
        identity: presentIdentity(identity),
        sessionId: session.id,
        requiresMfa: true,
        mfaTypes: activeMfas.map((m) => m.type),
      };
    }

    void auditService
      .log({
        action: "USER_LOGIN_SUCCESS",
        identityId: identity.id,
        ip: ctx.ip ?? "0.0.0.0",
      })
      .catch(() => {});

    void notificationService
      .sendNewDeviceLogin(identity.primaryEmail ?? "unknown@arcid.local", {
        ip: ctx.ip ?? "0.0.0.0",
        userAgent: ctx.userAgent ?? "Unknown User Agent",
      })
      .catch(() => {});

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
