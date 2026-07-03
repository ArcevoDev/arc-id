// src/modules/idp/routes/idp.route.ts
//
// FIX: OIDC callback was decoding id_token claims without signature
// verification — a serious security gap. An attacker who could intercept
// or forge the token exchange response could inject arbitrary claims.
//
// Fix: after exchanging the code for tokens, the id_token is now verified
// using jose.jwtVerify() against the IdP's JWKS (fetched from the
// discovery document's jwks_uri). jose + createRemoteJWKSet are already
// installed (jose@^6.2.3 is in package.json).
//
// The verified claims are used instead of the raw decoded payload.
// Verification validates: signature, issuer (iss), audience (aud), expiry.
//
// All other routes (SAML, CRUD) are unchanged from the previous version.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";
import {
  CreateConnectionSchema,
  UpdateConnectionSchema,
  ConnectionParamsSchema,
  TenantSlugParamsSchema,
  OidcCallbackQuerySchema,
  type CreateConnectionInput,
  type UpdateConnectionInput,
} from "../validators/idp.schemas";
import {
  assertTenantAdmin,
  buildSamlInstance,
  federatedLogin,
  generateSamlMetadata,
  generateMinimalSamlMetadata,
} from "../services/idp.service";
import { config } from "@/core/config";

export async function idpRoute(fastify: FastifyInstance) {
  // ── POST /idp/connections ──────────────────────────────────────────────────
  fastify.post(
    "/connections",
    {
      preHandler: fastify.auth.requirePlan("ENTERPRISE"),
      schema: {
        tags: ["Identity Provider Federation"],
        summary:
          "Create an IdP federation connection — SAML2, OIDC, or OAUTH2 (ENTERPRISE)",
        security: [{ bearerAuth: [] }],
        body: CreateConnectionSchema,
        response: { 201: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const body = req.body as CreateConnectionInput;
      await assertTenantAdmin(fastify, req.identity.id, body.tenantId);

      const connection = await fastify.db.idpConnection.create({
        data: {
          tenantId: body.tenantId,
          name: body.name,
          protocol: body.type,
          enabled: true,
          clientId: body.clientId ?? null,
          clientSecret: body.clientSecret ?? null,
          entryPoint: body.entryPoint ?? null,
          issuer: body.issuer ?? null,
          cert: body.cert ?? null,
          metadataUrl: body.metadataUrl ?? null,
        },
      });

      void auditService
        .log({
          action: "IDP_CONNECTION_CREATED",
          identityId: req.identity.id,
          tenantId: body.tenantId,
          ip: req.ip,
          metadata: { connectionId: connection.id, type: body.type },
        })
        .catch(() => {});

      const { clientSecret: _, ...safe } = connection;
      return reply.status(201).send({ success: true, data: safe });
    },
  );

  // ── GET /idp/connections ───────────────────────────────────────────────────
  fastify.get(
    "/connections",
    {
      preHandler: fastify.auth.requirePlan("ENTERPRISE"),
      schema: {
        tags: ["Identity Provider Federation"],
        summary: "List IdP connections for the active tenant (ENTERPRISE)",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ success: z.boolean(), data: z.array(z.any()) }),
        },
      },
    },
    async (req, reply) => {
      const tenantId = req.identity.tenantId;
      if (!tenantId) {
        throw ApiError.badRequest(
          "Switch to a tenant context first via POST /auth/context/switch",
        );
      }

      const connections = await fastify.db.idpConnection.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });

      const safe = connections.map(({ clientSecret: _, ...c }) => c);
      return reply.send({ success: true, data: safe });
    },
  );

  // ── GET /idp/connections/:id ───────────────────────────────────────────────
  fastify.get(
    "/connections/:id",
    {
      preHandler: fastify.auth.requirePlan("ENTERPRISE"),
      schema: {
        tags: ["Identity Provider Federation"],
        summary: "Get a single IdP connection by ID (ENTERPRISE)",
        security: [{ bearerAuth: [] }],
        params: ConnectionParamsSchema,
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const connection = await fastify.db.idpConnection.findUnique({
        where: { id },
      });
      if (!connection) throw ApiError.notFound("IdP connection not found");
      await assertTenantAdmin(fastify, req.identity.id, connection.tenantId);

      const { clientSecret: _, ...safe } = connection;
      return reply.send({ success: true, data: safe });
    },
  );

  // ── PATCH /idp/connections/:id ─────────────────────────────────────────────
  fastify.patch(
    "/connections/:id",
    {
      preHandler: fastify.auth.requirePlan("ENTERPRISE"),
      schema: {
        tags: ["Identity Provider Federation"],
        summary: "Update IdP connection settings (ENTERPRISE)",
        security: [{ bearerAuth: [] }],
        params: ConnectionParamsSchema,
        body: UpdateConnectionSchema,
        response: { 200: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as UpdateConnectionInput;

      const existing = await fastify.db.idpConnection.findUnique({
        where: { id },
      });
      if (!existing) throw ApiError.notFound("IdP connection not found");
      await assertTenantAdmin(fastify, req.identity.id, existing.tenantId);

      const updated = await fastify.db.idpConnection.update({
        where: { id },
        data: {
          name: body.name,
          clientId: body.clientId,
          clientSecret: body.clientSecret,
          entryPoint: body.entryPoint,
          issuer: body.issuer,
          cert: body.cert,
          metadataUrl: body.metadataUrl,
        },
      });

      void auditService
        .log({
          action: "IDP_CONNECTION_UPDATED",
          identityId: req.identity.id,
          tenantId: existing.tenantId,
          ip: req.ip,
          metadata: { connectionId: id },
        })
        .catch(() => {});

      const { clientSecret: _, ...safe } = updated;
      return reply.send({ success: true, data: safe });
    },
  );

  // ── DELETE /idp/connections/:id ────────────────────────────────────────────
  fastify.delete(
    "/connections/:id",
    {
      preHandler: fastify.auth.requirePlan("ENTERPRISE"),
      schema: {
        tags: ["Identity Provider Federation"],
        summary: "Remove an IdP connection (ENTERPRISE)",
        security: [{ bearerAuth: [] }],
        params: ConnectionParamsSchema,
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = await fastify.db.idpConnection.findUnique({
        where: { id },
      });
      if (!existing) throw ApiError.notFound("IdP connection not found");
      await assertTenantAdmin(fastify, req.identity.id, existing.tenantId);

      await fastify.db.idpConnection.delete({ where: { id } });

      void auditService
        .log({
          action: "IDP_CONNECTION_UPDATED",
          identityId: req.identity.id,
          tenantId: existing.tenantId,
          ip: req.ip,
          metadata: { connectionId: id, action: "deleted" },
        })
        .catch(() => {});

      return reply.send({ success: true });
    },
  );

  // ── GET /idp/saml/:tenantSlug/metadata — public ───────────────────────────
  fastify.get(
    "/saml/:tenantSlug/metadata",
    {
      schema: {
        tags: ["Identity Provider Federation"],
        summary:
          "SAML SP metadata XML — register this URL in your IdP admin panel",
        params: TenantSlugParamsSchema,
      },
    },
    async (req, reply) => {
      const { tenantSlug } = req.params as { tenantSlug: string };

      const tenant = await fastify.db.tenant.findFirst({
        where: { slug: tenantSlug },
        select: { id: true },
      });
      if (!tenant) throw ApiError.notFound("Tenant not found");

      const connection = await fastify.db.idpConnection.findFirst({
        where: { tenantId: tenant.id, protocol: "SAML2", enabled: true },
      });

      const xml =
        connection?.cert && connection?.entryPoint
          ? generateSamlMetadata(connection, tenantSlug)
          : generateMinimalSamlMetadata(tenantSlug);

      return reply.type("application/xml").send(xml);
    },
  );

  // ── POST /idp/saml/:tenantSlug/callback — public ──────────────────────────
  fastify.post(
    "/saml/:tenantSlug/callback",
    {
      schema: {
        tags: ["Identity Provider Federation"],
        summary:
          "SAML assertion consumer service — called by the external IdP after login",
        params: TenantSlugParamsSchema,
      },
    },
    async (req, reply) => {
      const { tenantSlug } = req.params as { tenantSlug: string };
      const body = req.body as any;

      if (!body?.SAMLResponse) {
        throw ApiError.badRequest("Missing SAMLResponse in POST body");
      }

      const tenant = await fastify.db.tenant.findFirst({
        where: { slug: tenantSlug },
        select: { id: true },
      });
      if (!tenant) throw ApiError.notFound("Tenant not found");

      const connection = await fastify.db.idpConnection.findFirst({
        where: { tenantId: tenant.id, protocol: "SAML2", enabled: true },
      });
      if (!connection) {
        throw ApiError.badRequest(
          "No active SAML2 IdP connection for this tenant",
        );
      }

      const saml = buildSamlInstance(connection, tenantSlug);

      let profile: Awaited<ReturnType<typeof saml.validatePostResponseAsync>>;
      try {
        profile = await saml.validatePostResponseAsync(body);
      } catch (err: any) {
        throw ApiError.unauthorized(
          `SAML assertion validation failed: ${err.message}`,
        );
      }

      const nameID = profile.profile?.nameID;
      if (!nameID) throw ApiError.badRequest("SAML assertion missing NameID");

      const email =
        (profile.profile?.[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
        ] as string | undefined) ??
        (profile.profile?.email as string | undefined) ??
        null;

      const name =
        (profile.profile?.[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
        ] as string | undefined) ??
        (profile.profile?.displayName as string | undefined) ??
        null;

      const tokenData = await federatedLogin(
        fastify,
        { nameID, email, name },
        `saml:${connection.id}`,
        tenant.id,
        req.ip,
        req.headers["user-agent"],
      );

      return reply.send({ success: true, data: tokenData });
    },
  );

  // ── GET /idp/oidc/:tenantSlug/callback — public ───────────────────────────
  // FIX: id_token is now cryptographically verified using jose.jwtVerify()
  // against the IdP's JWKS endpoint (fetched from the discovery document).
  // Previously the token was only base64-decoded without signature verification
  // — a forged or intercepted token would have been accepted as legitimate.
  fastify.get(
    "/oidc/:tenantSlug/callback",
    {
      schema: {
        tags: ["Identity Provider Federation"],
        summary:
          "OIDC federation callback — called by the external IdP after login",
        params: TenantSlugParamsSchema,
        querystring: OidcCallbackQuerySchema,
      },
    },
    async (req, reply) => {
      const { tenantSlug } = req.params as { tenantSlug: string };
      const { code, error, error_description } = req.query as {
        code?: string;
        error?: string;
        error_description?: string;
      };

      if (error) {
        throw ApiError.badRequest(
          `IdP error: ${error}${error_description ? ` — ${error_description}` : ""}`,
        );
      }
      if (!code) throw ApiError.badRequest("Missing authorization code");

      const tenant = await fastify.db.tenant.findFirst({
        where: { slug: tenantSlug },
        select: { id: true },
      });
      if (!tenant) throw ApiError.notFound("Tenant not found");

      const connection = await fastify.db.idpConnection.findFirst({
        where: {
          tenantId: tenant.id,
          protocol: { in: ["OIDC", "OAUTH2"] },
          enabled: true,
        },
      });
      if (!connection) {
        throw ApiError.badRequest(
          "No active OIDC/OAuth2 IdP connection for this tenant",
        );
      }
      if (!connection.clientId || !connection.clientSecret) {
        throw ApiError.badRequest(
          "IdP connection is missing clientId or clientSecret",
        );
      }

      // ── 1. Fetch OIDC discovery document ──────────────────────────────────
      const discoveryUrl =
        connection.metadataUrl ??
        (connection.issuer
          ? `${connection.issuer}/.well-known/openid-configuration`
          : null);

      if (!discoveryUrl) {
        throw ApiError.badRequest(
          "IdP connection requires metadataUrl or issuer for OIDC",
        );
      }

      const discoveryResp = await fetch(discoveryUrl);
      if (!discoveryResp.ok) {
        throw ApiError.badRequest("Failed to fetch OIDC discovery document");
      }
      const discovery = (await discoveryResp.json()) as {
        token_endpoint: string;
        jwks_uri: string;
        issuer: string;
      };

      if (
        !discovery.token_endpoint ||
        !discovery.jwks_uri ||
        !discovery.issuer
      ) {
        throw ApiError.badRequest(
          "OIDC discovery document is missing required fields (token_endpoint, jwks_uri, issuer)",
        );
      }

      // ── 2. Exchange authorization code for tokens ──────────────────────────
      const callbackUrl = `${config.base.apiUrl}/api/v1/idp/oidc/${tenantSlug}/callback`;

      const tokenResp = await fetch(discovery.token_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: callbackUrl,
          client_id: connection.clientId,
          client_secret: connection.clientSecret,
        }),
      });

      if (!tokenResp.ok) {
        throw ApiError.badRequest("Token exchange with IdP failed");
      }
      const tokens = (await tokenResp.json()) as any;

      if (!tokens.id_token) {
        throw ApiError.badRequest("IdP did not return an id_token");
      }

      // ── 3. Verify id_token signature using IdP's JWKS ─────────────────────
      // createRemoteJWKSet fetches and caches the IdP's public keys.
      // jwtVerify validates: signature, iss, aud, exp, nbf.
      // This is the critical fix — without this, a forged token is accepted.
      const JWKS = createRemoteJWKSet(new URL(discovery.jwks_uri));

      let claims: Record<string, unknown>;
      try {
        const { payload } = await jwtVerify(tokens.id_token, JWKS, {
          issuer: discovery.issuer,
          audience: connection.clientId,
        });
        claims = payload as Record<string, unknown>;
      } catch (err: any) {
        throw ApiError.unauthorized(
          `id_token verification failed: ${err.message ?? "invalid signature or claims"}`,
        );
      }

      // ── 4. Extract verified claims ─────────────────────────────────────────
      const sub = claims.sub as string | undefined;
      if (!sub) {
        throw ApiError.badRequest("Verified id_token is missing sub claim");
      }

      const tokenData = await federatedLogin(
        fastify,
        {
          nameID: sub,
          email: (claims.email as string | undefined) ?? null,
          name: (claims.name as string | undefined) ?? null,
        },
        `oidc:${connection.id}`,
        tenant.id,
        req.ip,
        req.headers["user-agent"],
      );

      return reply.send({ success: true, data: tokenData });
    },
  );
}
