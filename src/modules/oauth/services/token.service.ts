import { signJwt, AccessTokenClaims } from "@/lib/jwt";
import { generateToken } from "@/lib/crypto";
import { randomUUID } from "crypto";
import { addMinutes, addHours, addDays } from "date-fns";
import { FlowContext } from "@/core/flows";
import { config } from "@/core/config";

// ── TTL helpers
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

// ── Service ─────────────────────────────────────────────────────────────────

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

    const client = await db.client.findUniqueOrThrow({
      where: { clientId },
      select: { id: true },
    });

    const now = new Date();
    const issuer = "arcid";

    // Determine Strategy: If path exists and is not default empty string, use RS256
    const isRsa = Boolean(
      config.security.jwt.privateKey &&
      config.security.jwt.privateKey.length > 0,
    );
    const signOptions = isRsa
      ? {
          privateKeyOrSecret: config.security.jwt.privateKey,
          alg: "RS256" as const,
        }
      : { privateKeyOrSecret: config.jwt.secret, alg: "HS256" as const };

    const accessTtlMinutes = parseTtlToMinutes(config.jwt.accessTtl);
    const refreshTtlDays = parseTtlToDays(config.jwt.refreshTtl);
    const idTokenTtlHours = 1;

    const accessExpiry = addMinutes(now, accessTtlMinutes);
    const refreshExpiry = addDays(now, refreshTtlDays);
    const idExpiry = addHours(now, idTokenTtlHours);

    // 2. Generate Tokens
    const accessJti = randomUUID();
    const accessTokenJwt = await signJwt(
      {
        sub: identityId,
        jti: accessJti,
        scope: scopes.join(" "),
        aud: audience,
        ...(tenantId ? { tid: tenantId } : {}),
      } satisfies Partial<AccessTokenClaims>,
      { ...signOptions, expiresIn: `${accessTtlMinutes}m`, issuer },
    );

    const refreshTokenValue = generateToken(48);

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

    // 3. Atomic Database Operations
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

    await db.session.update({
      where: { id: sessionId },
      data: { refreshTokenId: refreshRecord.id },
    });

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
