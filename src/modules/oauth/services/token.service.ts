// src/modules/oauth/services/token.service.ts
//
// FIX: refreshToken.create was missing jti and familyId — both are now
// required by the schema (Phase C: refresh token family tree tracking).
//
// jti:      a UUID for this specific refresh token — tracked in the
//           blocklist for immediate revocation without DB scan.
// familyId: all tokens in one login session share this value.
//           On rotation, the child token inherits the parent's familyId.
//           Kill-chain logic can invalidate an entire session family by
//           deleting/revoking all rows WHERE familyId = X.
// parentJti: null for root tokens (issued at login); set to the consumed
//            token's jti for all rotated children.
//
// Token.service produces ROOT tokens (login/social/federated).
// token-refresh.flow produces CHILD tokens on rotation — it reads the
// parent's familyId and jti then passes them into a second issue() call
// or writes directly. That call site must also pass familyId/parentJti;
// see token-refresh.flow.ts Step 6.

import { signJwt, AccessTokenClaims } from "@/lib/jwt";
import { generateToken } from "@/lib/crypto";
import { randomUUID } from "crypto";
import { addMinutes, addHours, addDays } from "date-fns";
import { FlowContext } from "@/core/flows";
import { config } from "@/core/config";
import { resolvePemContent } from "@/api/plugins/jwt.plugin";

function parseTtlToMinutes(ttl: string | number): number {
  if (typeof ttl === "number") return ttl;
  const match = ttl.match(/^(\d+)([smhd])$/); // Fixed regex to support multi-digit TTL numbers
  if (!match) return 15;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "s":
      return Math.ceil(value / 60);
    case "m":
      return value;
    case "h":
      return value * 60;
    case "d":
      return value * 60 * 24;
    default:
      return 15;
  }
}

function parseTtlToDays(ttl: string | number): number {
  return Math.ceil(parseTtlToMinutes(ttl) / (60 * 24));
}

export interface IssueTokensParams {
  identityId: string;
  clientId: string;
  sessionId: string;
  scopes: string[];
  audience: string[];
  tenantId?: string | null;
  nonce?: string;
  /** For rotated tokens: the familyId of the parent token. Omit for root tokens. */
  familyId?: string;
  /** For rotated tokens: the jti of the consumed parent. Omit for root tokens. */
  parentJti?: string;
  /**
   * Authentication Assurance Level for this token. "aal1" | "aal2".
   * Omit entirely (do not pass null) for non-human grants — e.g.
   * client_credentials — where no end-user authenticated and assurance
   * level doesn't apply. Every human-authentication call site already
   * knows this value at the point it calls issue(); see SessionService
   * and the individual auth flows for where it's computed.
   */
  authLevel?: "aal1" | "aal2";
}

export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  idToken: string | null;
  expiresIn: number;
  authLevel: "aal1" | "aal2" | null; // Added to satisfy TS compilation constraints
}

export class TokenService {
  async issue(
    ctx: FlowContext,
    params: IssueTokensParams,
  ): Promise<TokenBundle> {
    const { db } = ctx;
    const {
      identityId,
      clientId,
      sessionId,
      scopes,
      audience,
      tenantId,
      nonce,
      familyId: incomingFamilyId,
      parentJti,
      authLevel,
    } = params;

    const activeTenantId = tenantId || "SYSTEM";

    const [client, activeSub, identity] = await Promise.all([
      db.client.findUnique({
        where: { clientId },
        select: { id: true, public: true, clientSecret: true },
      }),
      db.subscription.findFirst({
        where: { tenantId: activeTenantId },
        orderBy: { startedAt: "desc" },
        select: { plan: true, status: true },
      }),
      scopes.includes("openid")
        ? db.identity.findUniqueOrThrow({ where: { id: identityId } })
        : null,
    ]);

    if (!client) {
      throw new Error(`OAuth Client matching '${clientId}' not found.`);
    }

    const now = new Date();
    const issuer = "arcid";

    const privateKeyPem = resolvePemContent(config.security.jwt.privateKey);
    const publicKeyPem = resolvePemContent(config.security.jwt.publicKey);
    const useRsa = Boolean(privateKeyPem && publicKeyPem);

    const signOptions = useRsa
      ? { privateKeyOrSecret: privateKeyPem, alg: "RS256" as const }
      : {
          privateKeyOrSecret: config.security.jwt.secret,
          alg: "HS256" as const,
        };

    const accessTtlMinutes = parseTtlToMinutes(config.security.jwt.accessTtl);
    const refreshTtlDays = parseTtlToDays(config.security.jwt.refreshTtl);
    const idTokenTtlHours = 1;

    const accessExpiry = addMinutes(now, accessTtlMinutes);
    const refreshExpiry = addDays(now, refreshTtlDays);
    const idExpiry = addHours(now, idTokenTtlHours);

    const plan = activeSub?.status === "ACTIVE" ? activeSub.plan : "FREE";

    const accessJti = randomUUID();
    const idJti = randomUUID();
    const refreshJti = randomUUID(); // jti for this refresh token
    const refreshFamilyId = incomingFamilyId ?? randomUUID(); // new family for root tokens
    const refreshTokenValue = generateToken(48);

    // ── Access token JWT ──────────────────────────────────────────────────────
    const accessTokenPromise = signJwt(
      {
        sub: identityId,
        jti: accessJti,
        sid: sessionId,
        scope: scopes.join(" "),
        aud: audience,
        plan,
        ...(tenantId ? { tid: tenantId } : {}),
        ...(authLevel ? { aal: authLevel } : {}),
      } satisfies Partial<AccessTokenClaims> & { plan: string; sid: string },
      { ...signOptions, expiresIn: `${accessTtlMinutes}m`, issuer },
    );

    // ── ID token JWT ──────────────────────────────────────────────────────────
    let idTokenPromise = Promise.resolve<string | null>(null);
    let idClaims: Record<string, unknown> | null = null;

    if (identity) {
      idClaims = {
        sub: identityId,
        iss: issuer,
        aud: clientId,
        jti: idJti,
        ...(nonce ? { nonce } : {}),
        ...(identity.primaryEmail ? { email: identity.primaryEmail } : {}),
        email_verified: identity.emailVerified,
        ...(identity.name ? { name: identity.name } : {}),
        ...(identity.picture ? { picture: identity.picture } : {}),
        ...(identity.username ? { preferred_username: identity.username } : {}), // ← add this
        ...(authLevel ? { aal: authLevel } : {}),
      };
      idTokenPromise = signJwt(idClaims, {
        ...signOptions,
        expiresIn: `${idTokenTtlHours}h`,
        issuer,
      });
    }

    const [accessTokenJwt, idTokenJwt] = await Promise.all([
      accessTokenPromise,
      idTokenPromise,
    ]);

    // ── DB ledger writes ──────────────────────────────────────────────────────
    const dbWrites: Promise<unknown>[] = [
      db.accessToken.create({
        data: {
          token: accessTokenJwt,
          jti: accessJti,
          clientId: client.id,
          identityId,
          scopes,
          audience,
          issuedAt: now,
          expiresAt: accessExpiry,
          revoked: false,
        },
      }),

      db.refreshToken
        .create({
          data: {
            token: refreshTokenValue,
            // ── Phase C fields: family tree tracking ─────────────────────────
            jti: refreshJti,
            familyId: refreshFamilyId,
            parentJti: parentJti ?? null, // null = root token (first login)
            // ─────────────────────────────────────────────────────────────────
            clientId: client.id,
            identityId,
            sessionId,
            issuedAt: now,
            expiresAt: refreshExpiry,
            revoked: false,
            rotation: 0,
          },
        })
        .then((refreshRecord) => {
          if (sessionId) {
            return db.session.updateMany({
              where: { id: sessionId },
              data: { refreshTokenId: refreshRecord.id },
            });
          }
        }),
    ];

    if (idTokenJwt && idClaims) {
      dbWrites.push(
        db.idToken.create({
          data: {
            jti: idJti,
            clientId: client.id,
            identityId,
            claims: idClaims as any,
            issuedAt: now,
            expiresAt: idExpiry,
          },
        }),
      );
    }

    await Promise.all(dbWrites);

    return {
      accessToken: accessTokenJwt,
      refreshToken: refreshTokenValue,
      idToken: idTokenJwt,
      expiresIn: accessTtlMinutes * 60,
      authLevel: authLevel ?? null,
    };
  }
}
