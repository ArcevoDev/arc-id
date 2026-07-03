// src/modules/idp/validators/idp.schemas.ts
//
// All Zod schemas for the IDP federation module.
// Previously these were defined inline inside idp.route.ts.

import { z } from "zod";

// ── Connection management ─────────────────────────────────────────────────────

export const CreateConnectionSchema = z.object({
  tenantId: z.string().cuid("Invalid tenant ID"),
  type: z.enum(["SAML2", "OIDC", "OAUTH2"]),
  name: z.string().min(1).max(100),
  domain: z.string().optional(),
  entryPoint: z.string().url().optional(),
  issuer: z.string().optional(),
  // FIX: field is 'cert' in our DB/schema but the SAML library uses 'publicCert'
  // We accept 'cert' as the API surface and map to 'publicCert' inside buildSamlInstance.
  cert: z.string().optional(),
  metadataUrl: z.string().url().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  discoveryUrl: z.string().url().optional(),
});

export const UpdateConnectionSchema = CreateConnectionSchema.omit({
  tenantId: true,
  type: true,
}).partial();

export const ConnectionParamsSchema = z.object({
  id: z.string().cuid("Invalid connection ID"),
});

// ── SAML / OIDC callbacks ─────────────────────────────────────────────────────

export const TenantSlugParamsSchema = z.object({
  tenantSlug: z.string().min(1).max(100),
});

export const OidcCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type CreateConnectionInput = z.infer<typeof CreateConnectionSchema>;
export type UpdateConnectionInput = z.infer<typeof UpdateConnectionSchema>;
export type ConnectionParams = z.infer<typeof ConnectionParamsSchema>;
export type TenantSlugParams = z.infer<typeof TenantSlugParamsSchema>;
export type OidcCallbackQuery = z.infer<typeof OidcCallbackQuerySchema>;
