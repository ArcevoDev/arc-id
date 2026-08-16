# ArcID - Agent Instructions

> Loaded automatically every session. For the full handbook - status tables,
> rationale, and open work queue - see `CLAUDE.md` in this same root.
> This file is the compressed, always-loaded version of those same rules.
> If the two ever disagree, `CLAUDE.md` is the source of truth; fix this
> file to match it, not the other way round.

## What this is

ArcID: sovereign multi-tenant identity/IAM backend. Fastify + Prisma + Next.js
16 monorepo. OAuth2/OIDC provider, WebAuthn passkeys, TOTP MFA, SD-JWT
Verifiable Credentials, did:web, multi-tenant policy/RBAC, webhook delivery.
Version `0.1.0` in package.json (pre-release, no stability promises).

Package manager is **pnpm**. Module system is **ESM only** (`"type": "module"`
in package.json) - never emit `require()`/`module.exports`.

**Test suite:** 62 files / 340 tests / 0 code failures on `pnpm test` (all passing clean, ~4-5 min runtime on Windows - route-level + Prisma imports dominate). Migration-rollback Tier-2 is opt-in via `pnpm test:rollback` (needs a live Postgres). Typecheck clean (`tsc --noEmit`). Updated 2026-08-12.

## Non-negotiable architecture rules (same - stable)

1. **Business logic lives in Flows, never in routes.** `src/modules/<n>/flows/`.
   Routes are thin: auth guard → validate → `FlowExecutor.execute()` → reply.
2. **Errors are always `ApiError` static helpers.** Never `throw new Error()`.
3. **DB access**: inside a flow, always `ctx.db` (transaction-scoped). Inside
   a route directly, `fastify.db`. Never `import prisma` inside a flow.
   Always use `select` projections.
4. **Auth guards** via `preHandler`: `fastify.auth.requireUser`,
   `requireAal2`, `requireElevated`, `requirePlan("PRO")`,
   `requireScope("credential:issue")`. `request.identity.tenantId` exists;
   `request.identity.currentTenantId` does **not** - never reference it.
5. **Module shape** - every domain module under `src/modules/<n>/` owns
   `flows/ routes/ services/ repositories/ validators/ presenters/`.
6. **Frontend never calls the API directly.** Chain is always
   `page → component(s) → hook (use-*.ts) → Zustand store → SDK (src/sdk/index.ts, facet-sdk classes) → API`
7. **Tenant scoping**: every tenant-scoped query filters on `tenantId` taken
   from `req.params.tenantId` validated against membership - never trust
   `req.body.tenantId`.
8. **Security invariants** - never break these:
   - Any outbound fetch to a user-supplied URL passes through
     `assertSafeUrl()` first - no exceptions.
   - Access-token revocation always calls `blockJti` **and**
     `revokedJti.create` together - never one without the other.
   - New `TenantPolicy` fields must ship with their enforcement in the
     relevant flow in the same change.
   - Never hardcode a crypto algorithm - read it from the key or JWT header.
   - Federated login auto-link gated on `emailVerified === true` - both
     `social.route.ts` and `idp.service.ts` enforce this.

## File naming

`<n>.flow.ts` · `<n>.route.ts` · `<n>.service.ts` ·
`<n>.repository.ts` · `<n>.schemas.ts` · `<n>.presenter.ts` ·
`<n>.test.ts` (co-located with source) · `use-<n>.ts` (hooks) ·
`<n>.store.ts` · SDK classes live in `@arcevo/facet-sdk`

## Before writing any code, check

1. Does a flow already exist for this? `src/modules/*/flows/`.
2. Does the Prisma model already have the columns needed? `prisma/schema.prisma`.
3. Does the route already exist? `src/modules/*/routes/`, `src/api/routes/`.
4. Is there a matching case in `docs/planning/testing-guide.MD`? Match the
   request shape exactly.
5. Is this tenant-scoped? If so, does it need a `TenantPolicy` check?

## Current status

**Backend complete (0.1.0 equivalent).** All Phase 0 bugs fixed, all Phases 1–2
shipped. See `CLAUDE.md` for the full verified status table. Open work:

- **Docker deployment** - ✅ Done. Multi-stage `Dockerfile` (node:22-alpine),
  `docker-compose.yml` (Postgres 17 + Redis 7 + API + workers), `.dockerignore`,
  auto-migrate entrypoint, `.env.example`. `docker compose up -d` to run.
- **Frontend rebuild (Prompt 2) - SDK/stores/hooks/providers/layout complete.**
  SDK layer migrated to the published **`@arcevo/facet-sdk`** package (class-based
  `AuthSdk`/`TenantSdk`/etc.) - `src/sdk/index.ts` is now a thin singleton wiring
  that owns the `ArcIdClient` + 401 auto-refresh (wired to the Zustand auth
  store) and re-exports the facet domain SDKs. The old in-repo factory-pattern
  `src/sdk/*.sdk.ts` files are deleted. Hooks for credentials, MFA, webhooks,
  and API keys use the facet SDKs. Pages still need final cleanup (some import
  SDK directly instead of through hooks - pragmatically acceptable).
  **Tenant list route (`GET /tenants`) + tenant switcher wired (2026-07-28).**
- **Facet migration (`docs/migration/facet-migration-guide.md`)** - ✅
  **Phases 1–5 done.** Phase 1: SDK migrated to the published
  **`@arcevo/facet-sdk@1.1.0`** - `src/sdk/index.ts` is a thin
  singleton wiring that owns the `ArcIdClient` + 401 auto-refresh (wired
  to the Zustand auth store) and re-exports the facet domain SDKs; the
  old in-repo factory-pattern `src/sdk/*.sdk.ts` files are deleted.
  Phase 2: `@arcevo/facet-tokens/tokens.css` imported before
  `globals.css` in `layout.tsx`; `:root` token block removed from
  globals.css. Phase 3: `src/components/ui/*` deleted and all consumers
  switched to **`@arcevo/facet-components@1.5.0`** (icons use the
  package's native `<Icon name="…" />` registry - no local icon registry).
  Phase 4: auth pages on **`@arcevo/facet-auth@1.1.4`** via `ArcProvider` +
  `zustandTokenStorage` bridge (commit `d6f6707`); in-repo
  `login-form`/`register-form`/`mfa-form` deleted.
  Phase 5: layouts on **`@arcevo/facet-layout@1.3.1`** (`AuthLayout` +
  `ConsoleLayout`). Phase 6 purge is partial - `src/components/auth/`
  still holds `forgot-password-form`/`reset-password-form` (in use).
  All six facet packages pinned: sdk 1.1.0, components 1.5.0, auth 1.1.4,
  layout 1.3.1, tokens 1.1.0, cli 0.4.0, docs 1.4.1 (cli/docs installed
  as the basis for the upcoming `packages/cli` work).
- **Phase 3 - Security hardening** - ✅ **Closed (2026-07-28).** Cross-tenant HTTP integration test added (3 tests, fastify.inject, passes). SSRF call-site gaps (4/4 closed: idp.route OIDC discovery + token endpoint, webhook test-ping, SAML entryPoint). CSRF review complete - only OAuth state cookies in social.route.ts, all `sameSite: "lax"` + `httpOnly` + `secure`. Redis-backed distributed revocation done - `AccessToken.sessionId` column + migration + `DELETE /sessions/:id` revokes bound access tokens + blocks JTIs in Redis (full kill chain).
- **Phase 4 - Observability** - ✅ **Shipped (2026-07-28).** Correlation IDs through `FlowContext.requestId` → audit log metadata. `@fastify-metrics` at `GET /metrics`. Pino structured logs carry traceId on every flow init/ok/fail.
- **CLI + SDK packages** - deferred until frontend rebuild stabilises the
  API contract.
- **LegalConsent** - stays schema-only until a consumer exists.
- **ExternalIdentifier.verified → VC issuance** - deferred, needs design first.
