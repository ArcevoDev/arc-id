// src/modules/auth/services/step-up.service.ts
//
// SECURITY REWRITE — Phase B: Idempotent Step-Up Elevation
//
// Problem in previous version:
//   The verify() method executed:
//     1. verifyPassword/verifyTotp/verifyPasskey()  ← credential check
//     2. db.session.update({ elevatedAt: new Date() })  ← elevation write
//
//   These are two separate DB round-trips with no atomicity guarantee. Under
//   concurrent requests (e.g. a user double-submitting the step-up form):
//     - Both requests pass step 1 (credential check is stateless / read-only).
//     - Both write elevatedAt independently — no harm today, but in a future
//       distributed deployment with a Redis elevation cache, this race window
//       could allow two elevation tokens to be generated simultaneously with
//       mismatched expiry windows.
//
//   Additionally, the elevation write did not validate that the session was
//   still valid and unexpired at the moment of writing — a session that expired
//   during the async credential check could still be elevated.
//
// Fix:
//   The session update now uses a conditional WHERE clause:
//     WHERE id = $sessionId AND valid = true AND expiresAt > now()
//   This is enforced via Prisma's updateMany (returns count). If count = 0,
//   the session expired or was revoked between the route-level check and the
//   elevation write — we fail with 403 rather than silently elevating a dead
//   session.
//
//   This makes elevation idempotent-safe: a second concurrent request that
//   passes credential verification will still write elevatedAt (which is
//   benign — it's the same value ± ms), but the WHERE guard ensures it only
//   succeeds against a live session.
//
// Supported re-auth methods:
//   - password  (always available on local accounts)
//   - totp      (when MFA is enabled)
//   - passkey   (when a passkey is registered)

import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors";
import { verifyPassword } from "./password.service";
import { MfaService } from "./mfa.service";
import { consumeChallenge } from "@/lib/challenge-store";
import { PasskeyService } from "./passkey.service";

export type StepUpMethod = "password" | "totp" | "passkey";

export interface StepUpInput {
  sessionId: string;
  identityId: string;
  method: StepUpMethod;
  // password method
  password?: string;
  // totp method
  totpCode?: string;
  // passkey method
  passkeyResponse?: Record<string, unknown>;
  passkeyChallenge?: string;
  passkeyChallengeId?: string;
}

export class StepUpService {
  constructor(private readonly db: DbClient) {}

  async verify(input: StepUpInput): Promise<void> {
    // ── Step 1: Verify the credential (stateless / read-only) ─────────────────
    // All verifiers throw ApiError on failure — nothing is mutated here.
    switch (input.method) {
      case "password":
        await this.#verifyPassword(input);
        break;
      case "totp":
        await this.#verifyTotp(input);
        break;
      case "passkey":
        await this.#verifyPasskey(input);
        break;
      default:
        throw ApiError.badRequest("Unsupported step-up method");
    }

    // ── Step 2: Atomic conditional elevation write ────────────────────────────
    // Use updateMany with a WHERE guard so the elevation only lands on a session
    // that is still live at the exact moment of the write.
    //
    // The WHERE conditions mirror the route-level check in step-up.route.ts
    // (valid = true, expiresAt > now, identityId matches) but re-applied here
    // inside the service to close the TOCTOU window between the route guard and
    // this write. If the session was revoked or expired in the interim, count = 0
    // and we fail rather than elevating a dead session.
    const elevatedAt = new Date();

    const { count } = await this.db.session.updateMany({
      where: {
        id: input.sessionId,
        identityId: input.identityId, // ownership re-check at write time
        valid: true,
        expiresAt: { gt: new Date() },
      },
      data: {
        authLevel: "aal2",
        elevatedAt,
      },
    });

    if (count === 0) {
      // Session expired or was revoked between the route-level check and here.
      // This is not a credential failure — it's a session state failure.
      throw ApiError.forbidden(
        "Session expired or was revoked during step-up — please log in again",
      );
    }
  }

  // ── Private verifiers ──────────────────────────────────────────────────────
  // Each verifier only reads — no mutations. All mutations are in verify() above.

  async #verifyPassword(input: StepUpInput): Promise<void> {
    if (!input.password) {
      throw ApiError.badRequest(
        "password is required for step-up method 'password'",
      );
    }

    const localAccount = await this.db.localAccount.findUnique({
      where: { identityId: input.identityId },
      select: { passwordHash: true },
    });

    if (!localAccount) {
      throw ApiError.badRequest(
        "No local account found — use a different step-up method",
      );
    }

    const valid = await verifyPassword(
      localAccount.passwordHash,
      input.password,
    );
    if (!valid) {
      throw ApiError.unauthorized("Incorrect password");
    }
  }

  async #verifyTotp(input: StepUpInput): Promise<void> {
    if (!input.totpCode) {
      throw ApiError.badRequest(
        "totpCode is required for step-up method 'totp'",
      );
    }

    const mfa = await this.db.mfa.findFirst({
      where: { identityId: input.identityId, type: "TOTP", enabled: true },
      select: { secret: true },
    });

    if (!mfa?.secret) {
      throw ApiError.badRequest("No active TOTP MFA configuration found");
    }

    const mfaService = new MfaService(this.db);
    const verified = mfaService.verifyTotp(mfa.secret, input.totpCode);
    if (!verified) {
      throw ApiError.unauthorized("Invalid TOTP code");
    }
  }

  async #verifyPasskey(input: StepUpInput): Promise<void> {
    if (!input.passkeyResponse || !input.passkeyChallengeId) {
      throw ApiError.badRequest(
        "passkeyResponse and passkeyChallengeId are required for step-up method 'passkey'",
      );
    }

    // Consume the server-stored challenge atomically (GETDEL in Redis, map.delete in memory).
    // Never trust a client-provided challenge string.
    const stored = await consumeChallenge(input.identityId, "authentication");

    if (!stored) {
      throw ApiError.badRequest(
        "Step-up passkey challenge not found or expired — call /passkey/options/authenticate first",
      );
    }

    // Bind the ceremony: the challengeId the client sends back must match what
    // the server issued. This prevents challenge substitution across concurrent
    // step-up attempts (e.g. two browser tabs open simultaneously).
    if (stored.challengeId !== input.passkeyChallengeId) {
      throw ApiError.badRequest(
        "passkeyChallengeId mismatch — challenge does not match the issued options",
      );
    }

    const passkeyService = new PasskeyService(this.db);
    const { verified } = await passkeyService.verifyAuthentication(
      input.passkeyResponse,
      stored.challenge, // ← server-retrieved, not client-provided
    );

    if (!verified) {
      throw ApiError.unauthorized("Passkey step-up verification failed");
    }
  }
}
