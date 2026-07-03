// src/modules/oauth/flows/token-refresh.flow.ts
//
// Phase C: Atomic Refresh Token Rotation with family tree tracking.
//
// FIX (this session): Step 1 select now includes jti and familyId so that
// the rotated child token inherits the correct familyId and records its
// parentJti. Without this, every rotation started a NEW family, breaking
// the kill-chain — revoking by familyId would only hit the last token,
// leaving all previous siblings alive.
//
// FIX (earlier session): identity status check (Step 3) — suspended/banned
// users are blocked at rotation, not just at login.

import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { TokenService } from "../services/token.service";
import { presentTokenResponse } from "../presenters/token.presenter";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { blockJti } from "@/lib/security/jti-blocklist";

const RefreshSchema = z.object({
  refresh_token: z.string(),
  client_id: z.string(),
  client_secret: z.string().optional(),
});

export const tokenRefreshFlow: Flow<z.infer<typeof RefreshSchema>> = {
  name: "oauth:token-refresh",
  inputSchema: RefreshSchema,

  async execute(input, ctx: FlowContext) {
    const tokenService = new TokenService();

    // ── Step 1: Resolve the token record ──────────────────────────────────────
    // jti and familyId are selected so the child token can inherit them.
    // NOTE: no expiresAt filter here — we need to know WHY a token didn't
    // match (doesn't exist vs. expired vs. revoked) before deciding whether
    // this is a normal "please log in again" or a genuine theft signal.
    const existing = await ctx.db.refreshToken.findFirst({
      where: { token: input.refresh_token },
      select: {
        id: true,
        jti: true,
        familyId: true,
        revoked: true,
        expiresAt: true,
        clientId: true,
        identityId: true,
        sessionId: true,
      },
    });

    // ── Step 2a: Token genuinely doesn't exist — never issued, or already
    // pruned by token-cleanup.job.ts. Treat as suspicious (no family to kill,
    // but log it) — this is the one case where "not found" really might be
    // a guess/fabricated token.
    if (!existing) {
      void auditService
        .log({
          action: "TOKEN_REVOKED",
          ip: ctx.ip,
          metadata: { reason: "refresh_token_not_found" },
        })
        .catch(() => {});
      throw ApiError.invalidGrant("Refresh token is invalid");
    }

    // ── Step 2b: Token simply expired naturally — NOT a theft signal.
    // Ask the client to re-authenticate without nuking the whole session
    // family. This is the normal, expected end of a refresh token's life.
    if (existing.expiresAt <= new Date() && !existing.revoked) {
      throw ApiError.invalidGrant(
        "Refresh token has expired — please log in again",
      );
    }

    // ── Step 2c: Token was already revoked (rotated-and-reused, or
    // explicitly revoked) — this IS a genuine replay/theft signal.
    if (existing.revoked) {
      await triggerKillChain(ctx, input.refresh_token, existing);
    }

    // ── Step 3: Identity status check ────────────────────────────────────────
    const identity = await ctx.db.identity.findUnique({
      where: { id: existing!.identityId },
      select: { status: true },
    });

    if (!identity || identity.status === "DELETED") {
      throw ApiError.invalidGrant("Identity no longer exists");
    }
    if (identity.status === "SUSPENDED") {
      throw ApiError.forbidden("Account suspended");
    }
    if (identity.status === "BANNED") {
      throw ApiError.forbidden("Account banned");
    }

    // ── Step 4: Resolve client and scopes ─────────────────────────────────────
    const clientRecord = await ctx.db.client.findUnique({
      where: { id: existing!.clientId },
      select: { clientId: true, scopes: true },
    });

    if (!clientRecord) {
      throw ApiError.invalidGrant(
        "Client associated with this token no longer exists",
      );
    }

    const lastAccessToken = await ctx.db.accessToken.findFirst({
      where: {
        identityId: existing!.identityId,
        clientId: existing!.clientId,
        revoked: false,
      },
      orderBy: { issuedAt: "desc" },
      select: { scopes: true },
    });

    const scopes = (lastAccessToken?.scopes as string[] | null) ??
      (clientRecord.scopes as string[]) ?? [
        "openid",
        "profile",
        "email",
        "offline_access",
      ];

    // ── Step 5: Atomic compare-and-swap revocation ────────────────────────────
    const { count: revokedCount } = await ctx.db.refreshToken.updateMany({
      where: {
        id: existing!.id,
        revoked: false, // ← atomic guard against race
      },
      data: {
        revoked: true,
        rotatedAt: new Date(),
      },
    });

    if (revokedCount === 0) {
      // Lost the race — another request already rotated this token.
      await triggerKillChain(ctx, input.refresh_token, existing);
    }

    // ── Step 6: Issue the new (child) token pair ──────────────────────────────
    // Re-read the session's CURRENT authLevel rather than caching anything
    // from Step 1 — rotation doesn't re-verify a password or MFA, so the
    // level can only ever be carried forward, never assumed or upgraded.
    // existing.sessionId can point at a client.id (client_credentials
    // grants that requested offline_access produce a refresh token whose
    // sessionId is not a real Session row) — findUnique returns null in
    // that case and authLevel is correctly omitted rather than defaulted.
    const currentSession = existing!.sessionId
      ? await ctx.db.session.findUnique({
          where: { id: existing!.sessionId },
          select: { authLevel: true },
        })
      : null;

    const bundle = await tokenService.issue(ctx, {
      identityId: existing!.identityId,
      clientId: clientRecord.clientId,
      sessionId: existing!.sessionId ?? existing!.id,
      scopes,
      audience: [clientRecord.clientId],
      tenantId: ctx.tenantId,
      familyId: existing!.familyId, // inherit parent's family
      parentJti: existing!.jti, // record lineage
      authLevel: currentSession?.authLevel as "aal1" | "aal2" | undefined,
    });

    return presentTokenResponse(bundle);
  },
};

// ── Kill-chain ────────────────────────────────────────────────────────────────
// Revokes the entire session family (all tokens sharing the same familyId
// or sessionId) and invalidates the session. Called on replay detection.
//
// Also blocklists any access tokens already issued for this identityclient
// pair (Redis fast-path  DB-durable RevokedJti fallback), so a detected
// theft doesn't leave an already-issued access token usable for its
// remaining TTL. AccessToken has no sessionId/familyId column, so this is
// scoped by identityIdclientId rather than the precise session — slightly
// broader than ideal, but correct to err wide on a confirmed theft signal.
async function triggerKillChain(
  ctx: FlowContext,
  rawToken: string,
  existing: {
    id?: string;
    familyId?: string;
    sessionId?: string | null;
    identityId?: string;
    clientId?: string;
  } | null,
): Promise<never> {
  const sessionId = existing?.sessionId;
  const familyId = existing?.familyId;
  const identityId = existing?.identityId;
  const clientId = existing?.clientId;

  if (familyId) {
    // Revoke every token in the family — the most precise kill
    await Promise.all([
      ctx.db.refreshToken.updateMany({
        where: { familyId },
        data: { revoked: true },
      }),
      sessionId
        ? ctx.db.session.updateMany({
            where: { id: sessionId },
            data: { valid: false },
          })
        : Promise.resolve(),
    ]);
  } else if (sessionId) {
    await Promise.all([
      ctx.db.refreshToken.updateMany({
        where: { sessionId },
        data: { revoked: true },
      }),
      ctx.db.session.updateMany({
        where: { id: sessionId },
        data: { valid: false },
      }),
    ]);
  } else if (existing?.id) {
    await ctx.db.refreshToken.updateMany({
      where: { id: existing.id },
      data: { revoked: true },
    });
  } else {
    // Last resort: look up by raw token value
    const anyToken = await ctx.db.refreshToken.findFirst({
      where: { token: rawToken },
      select: {
        sessionId: true,
        familyId: true,
        identityId: true,
        clientId: true,
      },
    });
    if (anyToken) {
      await Promise.all([
        anyToken.familyId
          ? ctx.db.refreshToken.updateMany({
              where: { familyId: anyToken.familyId },
              data: { revoked: true },
            })
          : Promise.resolve(),
        anyToken.sessionId
          ? ctx.db.session.updateMany({
              where: { id: anyToken.sessionId },
              data: { valid: false },
            })
          : Promise.resolve(),
      ]);
      // The "last resort" branch doesn't have identityId/clientId from the
      // function's own parameters (existing was null) — pull it from the
      // token we just found instead, so the access-token sweep below still
      // has something to key on.
      await blocklistLiveAccessTokens(
        ctx,
        anyToken.identityId,
        anyToken.clientId,
      );
    }
  }

  // ── Blocklist any access tokens already issued for this identityclient,
  // independent of which branch above fired ──────────────────────────────
  if (identityId && clientId) {
    await blocklistLiveAccessTokens(ctx, identityId, clientId);
  }

  void auditService
    .log({
      action: "TOKEN_REVOKED",
      ip: ctx.ip,
      metadata: { reason: "replay_or_race_detected" },
    })
    .catch(() => {});

  throw ApiError.invalidGrant(
    "Refresh token is invalid, expired, or already used",
  );
}

// ── Shared helper: revoke  blocklist every live access token for an
// identityclient pair. Mirrors the exact pattern already used in
// revoke-token-by-id.flow.ts and token-revoke.flow.ts (DB revoked flag
// Redis blockJti with remaining TTL  DB-durable RevokedJti fallback),
// just applied to a set of tokens instead of one.
async function blocklistLiveAccessTokens(
  ctx: FlowContext,
  identityId: string,
  clientId: string,
): Promise<void> {
  const liveTokens = await ctx.db.accessToken.findMany({
    where: {
      identityId,
      clientId,
      revoked: false,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, jti: true, expiresAt: true },
  });

  if (liveTokens.length === 0) return;

  await ctx.db.accessToken.updateMany({
    where: { id: { in: liveTokens.map((t) => t.id) } },
    data: { revoked: true },
  });

  for (const t of liveTokens) {
    if (!t.jti) continue;
    const remainingTtlMs = t.expiresAt.getTime() - Date.now();
    const remainingTtlSec = Math.max(Math.ceil(remainingTtlMs / 1000), 1);

    void blockJti(t.jti, remainingTtlSec).catch(() => {});

    void ctx.db.revokedJti
      .create({ data: { jti: t.jti, expiresAt: t.expiresAt } })
      .catch(() => {});
  }
}
