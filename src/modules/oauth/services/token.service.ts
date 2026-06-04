// src/modules/oauth/services/token.service.ts
import { signJwt, AccessTokenClaims } from "@/lib/jwt";
import { generateToken } from "@/lib/crypto";
import { randomUUID } from "crypto";
import { addMinutes, addHours, addDays } from "date-fns";
import { FlowContext } from "@/core/flows";
import { config } from "@/core/config";
import { resolvePemContent } from "@/api/plugins/jwt.plugin";

// ─── TTL helpers ─────────────────────────────────────────────────────────────

function parseTtlToMinutes(ttl: string | number): number {
  if (typeof ttl === "number") return ttl;
  const match = ttl.match(/^(\d+)([smhd])$/);
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

// ─── Service Types ────────────────────────────────────────────────────────────

export interface IssueTokensParams {
  identityId: string;
  clientId: string;
  sessionId: string;
  scopes: string[];
  audience: string[];
  tenantId?: string | null;
  nonce?: string;
}

export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  idToken: string | null;
  expiresIn: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

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
    } = params;

    // Resolve DB client record safely
    const client = await db.client.findUnique({
      where: { clientId },
      select: { id: true, public: true, clientSecret: true },
    });

    if (!client) {
      throw new Error(`OAuth Client matching '${clientId}' not found.`);
    }

    const now = new Date();
    const issuer = "arcid";

    // ── Algorithm selection
    const privateKeyPem = resolvePemContent(config.security.jwt.privateKey);
    const publicKeyPem = resolvePemContent(config.security.jwt.publicKey);
    const useRsa = Boolean(privateKeyPem && publicKeyPem);

    const signOptions = useRsa
      ? { privateKeyOrSecret: privateKeyPem, alg: "RS256" as const }
      : { privateKeyOrSecret: config.jwt.secret, alg: "HS256" as const };

    const accessTtlMinutes = parseTtlToMinutes(config.jwt.accessTtl);
    const refreshTtlDays = parseTtlToDays(config.jwt.refreshTtl);
    const idTokenTtlHours = 1;

    const accessExpiry = addMinutes(now, accessTtlMinutes);
    const refreshExpiry = addDays(now, refreshTtlDays);
    const idExpiry = addHours(now, idTokenTtlHours);

    // ── Resolve decoupled subscription plan via Tenant context rather than Identity
    let plan = "FREE";
    const activeTenantId = tenantId || "SYSTEM";

    const activeSub = await db.subscription.findFirst({
      where: { 
        tenantId: activeTenantId
      },
      orderBy: { startedAt: "desc" },
      select: { plan: true, status: true },
    });
    
    if (activeSub?.status === "ACTIVE")
      plan = activeSub.plan;
    }

    // ── Sign Access Token
    const accessJti = randomUUID();
    const accessTokenJwt = await signJwt(
      {
        sub: identityId,
        jti: accessJti,
        scope: scopes.join(" "),
        aud: audience,
        plan,
        ...(tenantId ? { tid: tenantId } : {}),
      } satisfies Partial<AccessTokenClaims> & { plan: string },
      { ...signOptions, expiresIn: `${accessTtlMinutes}m`, issuer },
    );

    // ── Refresh Token (Opaque signature token string value)
    const refreshTokenValue = generateToken(48);

    // ── ID Token (only when openid scope requested)
    let idTokenJwt: string | null = null;
    const idJti = randomUUID();
    let idClaims: Record<string, unknown> | null = null;

    if (scopes.includes("openid")) {
      const identity = await db.identity.findUniqueOrThrow({
        where: { id: identityId },
      });
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
      };
      idTokenJwt = await signJwt(idClaims, {
        ...signOptions,
        expiresIn: `${idTokenTtlHours}h`,
        issuer,
      });
    }

    // ── Atomic DB writes
    await db.accessToken.create({
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
    });

    const refreshRecord = await db.refreshToken.create({
      data: {
        token: refreshTokenValue,
        clientId: client.id,
        identityId,
        sessionId,
        issuedAt: now,
        expiresAt: refreshExpiry,
        revoked: false,
        rotation: 0,
      },
    });

    // ── Update session with refresh token link ONLY for real sessions
    const sessionExists = await db.session.findFirst({
      where: { id: sessionId },
      select: { id: true },
    });
    if (sessionExists) {
      await db.session.update({
        where: { id: sessionId },
        data: { refreshTokenId: refreshRecord.id },
      });
    }

    if (idTokenJwt && idClaims) {
      await db.idToken.create({
        data: {
          jti: idJti,
          clientId: client.id,
          identityId,
          claims: idClaims as any,
          issuedAt: now,
          expiresAt: idExpiry,
        },
      });
    }

    return {
      accessToken: accessTokenJwt,
      refreshToken: refreshTokenValue,
      idToken: idTokenJwt,
      expiresIn: accessTtlMinutes * 60,
    };
  }
}