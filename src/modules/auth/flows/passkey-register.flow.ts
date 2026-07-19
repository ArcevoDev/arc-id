// src/modules/auth/flows/passkey-register.flow.ts
import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { PasskeyService } from "../services/passkey.service";
import { consumeChallenge } from "@/lib/challenge-store";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";

const PasskeyRegisterSchema = z.object({
  response: z.record(z.string(), z.unknown()),
  challengeId: z.string().uuid(),
  // `challenge: z.string()` removed — was the security vulnerability.
  // The server retrieves the challenge by (identityId, "registration", challengeId).
});

type Output = { verified: boolean };

export const passkeyRegisterFlow: Flow<
  z.infer<typeof PasskeyRegisterSchema>,
  Output
> = {
  name: "auth:passkey-register",
  inputSchema: PasskeyRegisterSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    if (!ctx.identityId) {
      throw ApiError.unauthorized(
        "Authentication required to register passkeys",
      );
    }

    // ── TenantPolicy.allowPasskeys enforcement ───────────────────────────────
    // Only blocks NEW passkey registration — existing passkeys can still be
    // used for authentication.  The schema default is true, so null means
    // no restriction.
    if (ctx.tenantId) {
      const policy = await ctx.db.tenantPolicy.findUnique({
        where: { tenantId: ctx.tenantId },
        select: { allowPasskeys: true },
      });
      if (policy && policy.allowPasskeys === false) {
        throw ApiError.forbidden(
          "Passkey registration is disabled for this tenant",
        );
      }
    }

    // Retrieve and atomically delete the server-stored challenge.
    // Returns null if: not found, expired, wrong ceremony, or wrong user.
    const stored = await consumeChallenge(ctx.identityId, "registration");

    if (!stored) {
      void auditService
        .log({
          action: "USER_LOGIN_FAILED",
          identityId: ctx.identityId,
          ip: ctx.ip,
          metadata: {
            reason: "passkey_registration_challenge_expired_or_missing",
          },
        })
        .catch(() => {});
      throw ApiError.badRequest(
        "Passkey challenge not found or expired — restart registration from /passkey/options/register",
      );
    }

    // Bind the challengeId from the client to the one we stored.
    // Prevents challenge substitution if multiple concurrent registrations are opened.
    if (stored.challengeId !== input.challengeId) {
      void auditService
        .log({
          action: "USER_LOGIN_FAILED",
          identityId: ctx.identityId,
          ip: ctx.ip,
          metadata: { reason: "passkey_registration_challenge_id_mismatch" },
        })
        .catch(() => {});
      throw ApiError.badRequest(
        "challengeId mismatch — the options and verification requests must belong to the same ceremony",
      );
    }

    const service = new PasskeyService(ctx.db);
    const result = await service.verifyRegistration(
      ctx.identityId,
      input.response,
      stored.challenge, // ← server-retrieved, not client-provided
    );

    if (!result.verified) {
      // verifyRegistration returned false — credential data was invalid
      void auditService
        .log({
          action: "USER_LOGIN_FAILED",
          identityId: ctx.identityId,
          ip: ctx.ip,
          metadata: { reason: "passkey_registration_verification_failed" },
        })
        .catch(() => {});
      return { verified: false };
    }

    // Successful registration — emit the dedicated audit action.
    // The credentialId is embedded in input.response.id (same field PasskeyService reads).
    const credentialId = (input.response as any)?.id as string | undefined;

    void auditService
      .log({
        action: "PASSKEY_REGISTERED",
        identityId: ctx.identityId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { credentialId },
      })
      .catch(() => {});

    return { verified: true };
  },
};
