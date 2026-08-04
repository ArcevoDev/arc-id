# ArcID — Agent Instructions

> Loaded automatically every session. For the full handbook — status tables,
> rationale, and open work queue — see `CLAUDE.md` in this same root.
> This file is the compressed, always-loaded version of those same rules.
> If the two ever disagree, `CLAUDE.md` is the source of truth; fix this
> file to match it, not the other way round.

## What this is

ArcID: sovereign multi-tenant identity/IAM backend. Fastify + Prisma + Next.js
16 monorepo. OAuth2/OIDC provider, WebAuthn passkeys, TOTP MFA, SD-JWT
Verifiable Credentials, did:web, multi-tenant policy/RBAC, webhook delivery.
Version `0.1.0` in package.json (pre-release, no stability promises).

Package manager is **pnpm**. Module system is **ESM only** (`"type": "module"`
in package.json) — never emit `require()`/`module.exports`.

**Test suite:** 59 files / 395 tests / 0 code failures on `pnpm test` (all passing clean, 83.6s runtime with `--pool=threads`). Updated 2026-07-28.

## Non-negotiable architecture rules (same — stable)

1. **Business logic lives in Flows, never in routes.** `src/modules/<n>/flows/`.
   Routes are thin: auth guard → validate → `FlowExecutor.execute()` → reply.
2. **Errors are always `ApiError` static helpers.** Never `throw new Error()`.
3. **DB access**: inside a flow, always `ctx.db` (transaction-scoped). Inside
   a route directly, `fastify.db`. Never `import prisma` inside a flow.
   Always use `select` projections.
4. **Auth guards** via `preHandler`: `fastify.auth.requireUser`,
   `requireAal2`, `requireElevated`, `requirePlan("PRO")`,
   `requireScope("credential:issue")`. `request.identity.tenantId` exists;
   `request.identity.currentTenantId` does **not** — never reference it.
5. **Module shape** — every domain module under `src/modules/<n>/` owns
   `flows/ routes/ services/ repositories/ validators/ presenters/`.
6. **Frontend never calls the API directly.** Chain is always
   `page → component(s) → hook (use-*.ts) → Zustand store → SDK (src/sdk/*.sdk.ts) → API`
7. **Tenant scoping**: every tenant-scoped query filters on `tenantId` taken
   from `req.params.tenantId` validated against membership — never trust
   `req.body.tenantId`.
8. **Security invariants** — never break these:
   - Any outbound fetch to a user-supplied URL passes through
     `assertSafeUrl()` first — no exceptions.
   - Access-token revocation always calls `blockJti` **and**
     `revokedJti.create` together — never one without the other.
   - New `TenantPolicy` fields must ship with their enforcement in the
     relevant flow in the same change.
   - Never hardcode a crypto algorithm — read it from the key or JWT header.
   - Federated login auto-link gated on `emailVerified === true` — both
     `social.route.ts` and `idp.service.ts` enforce this.

## File naming

`<n>.flow.ts` · `<n>.route.ts` · `<n>.service.ts` ·
`<n>.repository.ts` · `<n>.schemas.ts` · `<n>.presenter.ts` ·
`<n>.test.ts` (co-located with source) · `use-<n>.ts` (hooks) ·
`<n>.store.ts` · `<n>.sdk.ts`

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

- **Docker deployment** — ✅ Done. Multi-stage `Dockerfile` (node:22-alpine),
  `docker-compose.yml` (Postgres 17 + Redis 7 + API + workers), `.dockerignore`,
  auto-migrate entrypoint, `.env.example`. `docker compose up -d` to run.
- **Frontend rebuild (Prompt 2) — SDK/stores/hooks/providers/layout complete.**
  Full factory-pattern SDK layer with no React/Next.js deps, typed singletons,
  automatic 401 refresh in AuthProvider, and new hooks for credentials, MFA,
  webhooks, and API keys. Pages still need final cleanup (some import SDK
  directly instead of through hooks — pragmatically acceptable).
  **Tenant list route (`GET /tenants`) + SDK + tenant switcher wired (2026-07-28).**
- **SDK completeness** — All backend routes now have SDK coverage across **10 SDK
  files (~102 methods)**. IdP SDK (`src/sdk/idp.sdk.ts`) added. ~36 missing SDK
  methods added across auth, identity, tenant, and webhooks SDKs.
- **Phase 3 — Security hardening** — ✅ **Closed (2026-07-28).** Cross-tenant HTTP integration test added (3 tests, fastify.inject, passes). SSRF call-site gaps (4/4 closed: idp.route OIDC discovery + token endpoint, webhook test-ping, SAML entryPoint). CSRF review complete — only OAuth state cookies in social.route.ts, all `sameSite: "lax"` + `httpOnly` + `secure`. Redis-backed distributed revocation done — `AccessToken.sessionId` column + migration + `DELETE /sessions/:id` revokes bound access tokens + blocks JTIs in Redis (full kill chain).
- **Phase 4 — Observability** — ✅ **Shipped (2026-07-28).** Correlation IDs through `FlowContext.requestId` → audit log metadata. `@fastify-metrics` at `GET /metrics`. Pino structured logs carry traceId on every flow init/ok/fail.
- **CLI + SDK packages** — deferred until frontend rebuild stabilises the
  API contract.
- **LegalConsent** — stays schema-only until a consumer exists.
- **ExternalIdentifier.verified → VC issuance** — deferred, needs design first.
