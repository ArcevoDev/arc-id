// src/modules/idp/services/idp.service.ts
import { SAML } from "@node-saml/node-saml";
import type { FastifyInstance } from "fastify";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";
import { config } from "@/core/config";
import { SessionService } from "@/modules/auth/services/session.service";
import { TokenService } from "@/modules/oauth/services/token.service";
import { presentTokenResponse } from "@/modules/oauth/presenters/token.presenter";
import { generateToken } from "@/lib/crypto";
import { assertSafeUrl } from "@/lib/url-safety";

export interface FederatedProfile {
  nameID: string;
  email: string | null;
  name: string | null;
}

// ── OpenID Connect / Metadata Discovery Helper ───────────────────────────────

/**
 * Validates and fetches OIDC discovery documents securely.
 */
export async function fetchDiscoveryMetadata(discoveryUrl: string): Promise<Record<string, any>> {
  assertSafeUrl(discoveryUrl);
  const discoveryResp = await fetch(discoveryUrl);
  if (!discoveryResp.ok) {
    throw ApiError.badRequest(`Failed to fetch discovery metadata: ${discoveryResp.statusText}`);
  }
  return discoveryResp.json();
}

// ── SAML instance builder ─────────────────────────────────────────────────────

/**
 * Builds a @node-saml/node-saml SAML instance from a stored IdP connection row.
 * Assigning connection.cert to both properties satisfies types and guarantees validation.
 */
export function buildSamlInstance(
  connection: {
    entryPoint: string | null;
    issuer: string | null;
    cert: string | null;
  },
  tenantSlug: string,
): SAML {
  if (!connection.entryPoint) {
    throw ApiError.badRequest("IdP entryPoint (SSO URL) is not configured");
  }
  if (!connection.cert) {
    throw ApiError.badRequest("IdP certificate is not configured");
  }

  const callbackUrl = `${config.base.apiUrl}/api/v1/idp/saml/${tenantSlug}/callback`;
  const entityId = `${config.base.apiUrl}/api/v1/idp/saml/${tenantSlug}/metadata`;

  return new SAML({
    entryPoint: connection.entryPoint,
    issuer: connection.issuer ?? entityId,
    publicCert: connection.cert,
    idpCert: connection.cert, // Resolves structural requirement error TS2345
    callbackUrl,
    wantAssertionsSigned: true,
    acceptedClockSkewMs: 300_000,
  });
}

// ── SAML SP metadata ──────────────────────────────────────────────────────────

/**
 * Returns SAML SP metadata XML for the given tenant.
 */
export function generateSamlMetadata(
  connection: {
    entryPoint: string | null;
    issuer: string | null;
    cert: string | null;
  },
  tenantSlug: string,
): string {
  const saml = buildSamlInstance(connection, tenantSlug);
  return saml.generateServiceProviderMetadata(null, null);
}

// ── Minimal SP metadata fallback ──────────────────────────────────────────────

/**
 * Fallback metadata for tenants that haven't configured a cert/entryPoint yet.
 */
export function generateMinimalSamlMetadata(tenantSlug: string): string {
  const acsUrl = `${config.base.apiUrl}/api/v1/idp/saml/${tenantSlug}/callback`;
  const entityId = `${config.base.apiUrl}/api/v1/idp/saml/${tenantSlug}/metadata`;

  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}"
      index="0"
      isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}

// ── Admin assertion ───────────────────────────────────────────────────────────

export async function assertTenantAdmin(
  fastify: FastifyInstance,
  identityId: string,
  tenantId: string,
): Promise<void> {
  const m = await fastify.db.tenantMembership.findFirst({
    where: { identityId, tenantId, status: "ACTIVE" },
    include: { role: { select: { name: true } } },
  });
  if (!m || m.role.name !== "ADMIN") {
    throw ApiError.forbidden("Tenant ADMIN access required to manage IdP connections");
  }
}

// ── Federated login ───────────────────────────────────────────────────────────

/**
 * JIT-provisions an identity from a federated IdP profile and issues tokens.
 */
export async function federatedLogin(
  fastify: FastifyInstance,
  profile: FederatedProfile,
  provider: string,
  tenantId: string,
  ip: string,
  userAgent: string | undefined,
): Promise<ReturnType<typeof presentTokenResponse>> {
  const db = fastify.db;

  const { identity, session } = await db.$transaction(async (tx) => {
    // 1. Look up existing federated account
    const existing = await tx.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: profile.nameID,
        },
      },
      include: { identity: true },
    });

    let resolvedIdentity: Awaited<ReturnType<typeof tx.identity.findUniqueOrThrow>>;

    if (existing) {
      resolvedIdentity = existing.identity;
    } else {
      // 2. Try to match by email (link to existing identity)
      let newIdentity = profile.email
        ? await tx.identity.findFirst({ where: { primaryEmail: profile.email } })
        : null;

      if (newIdentity && !newIdentity.emailVerified) {
        throw ApiError.conflict(
          "An account with this email already exists but hasn't been verified yet. " +
            "Please verify your email or sign in with your password first, then link this identity provider from your account settings.",
        );
      }

      if (!newIdentity) {
        // 3a. Create new identity
        newIdentity = await tx.identity.create({
          data: {
            primaryEmail: profile.email,
            name: profile.name,
            status: "ACTIVE",
            emailVerified: Boolean(profile.email),
          },
        });

        // Auto-add to tenant as MEMBER role
        const memberRole = await tx.role.findFirst({
          where: { tenantId, name: "MEMBER" },
          select: { id: true },
        });

        if (!memberRole) {
          throw ApiError.internal(
            `Failed JIT provisioning: 'MEMBER' role missing for tenant ${tenantId}.`,
          );
        }

        await tx.tenantMembership.create({
          data: {
            identityId: newIdentity.id,
            tenantId,
            roleId: memberRole.id,
            status: "ACTIVE",
          },
        });
      }

      // 3b. Link the federated account
      await tx.oAuthAccount.create({
        data: {
          identityId: newIdentity.id,
          provider,
          providerUserId: profile.nameID,
          accessToken: generateToken(16),
        },
      });

      resolvedIdentity = newIdentity;
    }

    // 4. Guard against banned/suspended accounts
    if (resolvedIdentity.status === "SUSPENDED") {
      throw ApiError.forbidden("Account suspended");
    }
    if (resolvedIdentity.status === "BANNED") {
      throw ApiError.forbidden("Account banned");
    }

    // 5. Create session (safely cast tx to support Prisma Client Transactions)
    const sessionService = new SessionService(tx as unknown as typeof db);
    const { session: newSession } = await sessionService.create({
      identityId: resolvedIdentity.id,
      ip,
      userAgent: userAgent ?? null,
      authLevel: "aal1",
    });

    return { identity: resolvedIdentity, session: newSession };
  });

  // 6. Issue tokens (happens safely outside db transaction block)
  const tokenService = new TokenService();
  const directClientId = config.oauth.directClientId;

  const bundle = await tokenService.issue(
    {
      db: fastify.db,
      tenantId,
      identityId: identity.id,
      requestId: "",
    } as any, // Cast if your framework context shape varies from Oauth2 options
    {
      identityId: identity.id,
      clientId: directClientId,
      sessionId: session.id,
      scopes: ["openid", "profile", "email", "offline_access"],
      audience: [directClientId],
      tenantId,
      authLevel: "aal1",
    },
  );

  void auditService
    .log({
      action: "SESSION_CREATED",
      identityId: identity.id,
      ip,
      metadata: { provider },
    })
    .catch(() => {});

  return presentTokenResponse(bundle);
}