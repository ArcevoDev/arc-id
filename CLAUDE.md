# ArcID — Claude Code Handbook

> This file is read by Claude Code (claude.ai/code) before touching anything.
> It is the single source of truth for how to work on this project.
> Keep it updated as the codebase evolves.

---

## What ArcID is

ArcID is a sovereign, multi-tenant identity and access management backend built
to solve identity fragmentation in the Nigerian and broader African digital
ecosystem. The long-term goal is a single canonical identity that a person
carries across sectors — government, healthcare, education, finance, agriculture.

Right now it is a **Fastify + Prisma + Next.js monorepo** that provides:
- Full OAuth 2.0 / OIDC provider (authorize/token/refresh/revoke/introspect/JWKS)
- WebAuthn passkeys + TOTP MFA + magic link + social/SAML federation
- SD-JWT Verifiable Credentials + W3C BitstringStatusList revocation + did:web
- Multi-tenant architecture with per-tenant policy, roles, and signing keys
- Webhook delivery engine (Postgres-backed `FOR UPDATE SKIP LOCKED`)
- Admin dashboard (Next.js 16, Tailwind, shadcn/ui, Zustand)

Version is `0.0.*` (pre-release, pre-deployment). Versioning scheme is semver
starting from `0.0.1` — no breaking-change promises yet.

---

## Repository layout

```
arc-id/
├── src/
│   ├── api/              # Fastify server — plugins, routes, server entrypoints
│   │   ├── plugins/      # auth-guard, jwt, db, rate-limit, swagger
│   │   ├── routes/       # well-known, health, DID document, mail-preview
│   │   └── server/       # build-server.ts, start-server.ts, start-workers.ts
│   ├── app/              # Next.js 16 App Router pages
│   │   ├── (auth)/       # login, register, MFA, passkey, password reset
│   │   └── (dashboard)/  # admin UI pages
│   ├── components/       # React components (arc/, layout/, shared/, ui/)
│   ├── core/             # Shared fundamentals — config, db, errors, flows, mail
│   ├── hooks/            # React hooks (use-auth, use-sessions, use-passkeys, …)
│   ├── jobs/             # Background jobs — token-cleanup, webhook-worker
│   ├── lib/              # Pure utilities — jwt, crypto, security, url-safety
│   ├── modules/          # Domain modules — each owns routes/flows/services/repos
│   │   ├── auth/         # login, register, MFA, passkey, magic-link, sessions
│   │   ├── billing/      # subscription, upgrade, webhook verification
│   │   ├── credentials/  # DID, SD-JWT, VC issuance/revocation/verify
│   │   ├── identity/     # profile, delegation, external identifiers, admin
│   │   ├── idp/          # SAML2 + OIDC federation
│   │   ├── oauth/        # authorize, token exchange/refresh/revoke, introspect
│   │   ├── tenant/       # tenant CRUD, policy, members, signing keys, projects
│   │   ├── audit/        # audit log writes and read routes
│   │   └── webhooks/     # webhook endpoint config + delivery event routes
│   ├── providers/        # React context providers (auth, theme)
│   ├── sdk/              # Frontend HTTP client — one file per domain
│   ├── store/            # Zustand stores (auth, tenant, ui)
│   └── types/            # Shared TypeScript types
├── prisma/
│   ├── schema.prisma     # Single source of truth for the data model
│   ├── seed.ts           # Dev/staging seed — creates SYSTEM tenant, admin, roles
│   └── migrations/       # Never hand-edit; always `pnpm prisma:migrate`
├── docs/planning/        # Planning documents — read before big changes
│   ├── arcid-v1-roadmap.md   # THE operative roadmap
│   ├── ARCID_PROGRESS.md     # Phase-by-phase status tracker
│   └── testing-guide.MD      # Full API test matrix
├── CLAUDE.md             # ← you are here
└── .commandcode/taste/taste.md  # CommandCode learned preferences
```

---

## Running the project

```bash
# Install
pnpm install

# Database setup (first time)
pnpm prisma:migrate     # runs migrations
pnpm seed               # seeds SYSTEM tenant, admin user, roles

# Development (all three processes)
pnpm dev:all            # Next.js + Fastify API + background workers

# Individual processes
pnpm dev:web            # Next.js only (port 3000)
pnpm dev:api            # Fastify API only (port 4000)
pnpm dev:workers        # Background workers only

# Type checking
pnpm typecheck

# Lint + format
pnpm lint
pnpm format
```

There is no test runner yet. Tests are tracked in `docs/planning/testing-guide.MD`
as a manual matrix. **Vitest is the chosen test framework** — the next major
engineering task is adding it. See the Testing section below.

---

## Architecture rules — read before writing any code

### 1. Flows are the unit of business logic

Every multi-step operation lives in a `Flow` (`src/core/flows/flow.ts`):
```ts
interface Flow<I, O> {
  name: string;
  inputSchema: ZodSchema<I>;
  outputSchema?: ZodSchema<O>;
  execute(input: I, ctx: FlowContext): Promise<O>;
}
```
Flows are run via `FlowExecutor` which wraps them in a Prisma transaction,
injects `FlowContext` (includes `db`, `identityId`, `tenantId`, `ip`, `requestId`),
and validates input/output schemas. **Never put business logic in routes.**
Routes are thin: authenticate → validate → `FlowExecutor.execute(flow, body, ctx)` → reply.

### 2. Error handling

Always throw `ApiError` static helpers. Never throw raw `Error`.
```ts
throw ApiError.notFound("Session not found");
throw ApiError.forbidden("Permission required: credential:issue");
throw ApiError.invalidGrant("Refresh token already used");
```
OAuth errors use their RFC 6749 code variants: `invalidGrant`, `invalidClient`,
`invalidRequest`, `invalidScope`, `unsupportedGrantType`.

### 3. Database access

- In flows: use `ctx.db` (the transaction-scoped Prisma client).
- In routes directly: use `fastify.db` (the global Prisma client).
- Never import `prisma` directly inside a flow — always `ctx.db`.
- Always use `select` projections in queries. Never pull full rows when you
  only need two fields.
- When adding new columns: `pnpm prisma:migrate` — never hand-edit migrations.

### 4. Auth guard patterns

Routes are protected via `preHandler` or `onRequest`:
```ts
preHandler: fastify.auth.requireUser         // any authenticated user
preHandler: fastify.auth.requireAal2          // MFA/passkey completed
preHandler: fastify.auth.requireElevated      // step-up (15-min window)
preHandler: fastify.auth.requirePlan("PRO")   // subscription gate
preHandler: fastify.auth.requireScope("credential:issue")
```
`request.identity` after `requireUser` has: `{ id, tenantId, scope, plan }`.
There is NO `currentTenantId` on `request.identity` — use `request.identity.tenantId`.

### 5. Module structure

Each module under `src/modules/<name>/` owns:
```
flows/        → business logic (the real code)
routes/       → thin HTTP handlers
services/     → stateful helpers (SessionService, TokenService, etc.)
repositories/ → DB query helpers
validators/   → Zod schemas
presenters/   → shape transformations (DB row → API response)
```

### 6. SDK layer

Frontend code **never** calls the API directly. The call chain is always:
```
page/component → hook (use-*.ts) → store (Zustand) → SDK (src/sdk/*.sdk.ts) → API
```
The SDK layer (`src/sdk/`) is a typed HTTP client. Each file maps one domain.
`src/sdk/client.ts` has the base request function and `TOKEN_KEYS` constants.

### 7. Tenant scoping

Every DB query inside a tenant-scoped route must include `tenantId` in the
`where` clause. Never trust `req.body.tenantId` — always use
`req.params.tenantId` validated against the authenticated identity's membership.

### 8. Security invariants — never break these

- SSRF: All outbound HTTP calls to user-supplied URLs must pass through
  `assertSafeUrl(url)` from `src/lib/url-safety.ts` before `fetch()`.
- `blockJti` + `revokedJti.create` must be called together on any access
  token revocation. Never one without the other.
- `FlowContext.db` is always a transaction. Never write to the DB outside
  a transaction when the operation spans multiple tables.
- `TenantPolicy` fields are enforced at auth-flow level. If you add a new
  policy field, add its enforcement in the relevant flow before shipping.

---

## Current status (verified against source)

### ✅ Done and solid — do not re-examine unless a bug is reported
- Full auth engine: password, passkey, TOTP MFA, magic link, social, SAML
- OAuth 2.0 / OIDC: authorize, token exchange/refresh/revoke/introspect
- Refresh token rotation with family-tree kill-chain
- JTI blocklist (Redis two-tier + DB fallback) in auth-guard
- PKCE enforcement (mandatory default, exchange-time defense-in-depth)
- SSRF defense on webhooks and IdP metadata URLs
- Webhook delivery engine (Postgres-queue, retry, backoff, dead-letter visibility)
- SD-JWT VC issuance, BitstringStatusList revocation, did:web
- Multi-tenant: tenant, membership, policy CRUD, signing keys, projects
- Rate limiting (per-IP and per-identity), audit logging, session elevation

### ❌ Open — the actual work queue

**Immediate (1-3 days each):**
1. `TenantPolicy` enforcement — `requireMfa` in `login.flow.ts`,
   `maxSessionsPerUser` + `sessionTtlMinutes` in `session.service.ts`,
   `allowedEmailDomains` in `register.flow.ts`,
   `allowPasskeys` in passkey flows. These fields are written by the UI
   and **silently ignored** by auth flows. This is the most important gap.
2. RBAC — `Permission` and `RolePermission` tables exist in the schema,
   are migrated, have zero rows and zero enforcement. Every authz check is
   `role.name === "ADMIN"`. Build `src/lib/security/rbac.ts` with
   `hasPermission()` and `requirePermission()`, seed initial permission rows,
   replace all `assertTenantAdmin()` call sites.

**Upcoming (multi-day):**
3. Vitest setup — no test runner exists. Add vitest, write unit tests for
   flows and services. Start with `login.flow.ts`, `session.service.ts`,
   `token.service.ts`, `jti-blocklist.ts`.
4. `ExternalIdentifier` routes/flows — the cross-sector identity linking
   model exists in schema, nothing touches it. Build the self-reported
   linking flow first (`POST /identity/external-ids`).
5. ArcWallet API surface — credential offer endpoint, wallet binding,
   lightweight presentation endpoint (custom, not OIDC4VP for v1).
6. `CredentialOffer` model (migration needed) for the offer flow.

**Deferred to v2:**
- Full OIDC4VCI/OIDC4VP spec compliance
- `did:key`, `did:jwk` DID methods
- BBS+ selective disclosure
- PgBouncer (infra config, not code)
- Distributed cron leader election
- Native ArcWallet app

---

## Testing strategy

**Framework:** Vitest (not Jest — ESM-native, compatible with the project's
`"type": "module"` in package.json, fast).

**Where tests live:** `src/**/*.test.ts` co-located with source files.

**Layers to test:**
1. Unit: flows (mock `ctx.db` with vi.fn), services, validators, utilities.
2. Integration: routes via Fastify's `inject()` — no live DB, use in-memory
   mocks or a test Postgres schema.
3. Do NOT write component tests yet — the frontend is not the current priority.

**What to test first** (in this order):
1. `login.flow.ts` — the most critical path, most moving parts
2. `session.service.ts` — TTL, session creation, authLevel
3. `token.service.ts` — issue(), authLevel threading
4. `jti-blocklist.ts` — block/check/fallback behavior
5. `triggerKillChain` in `token-refresh.flow.ts`

**How to add vitest:**
```bash
pnpm add -D vitest @vitest/coverage-v8
```
Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```
Add `vitest.config.ts` at project root:
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

---

## Versioning

Current: `0.0.1` (starting point — was incorrectly set to `0.1.0`).

Scheme:
- `0.0.*` — pre-deployment, breaking changes expected, no public API contract
- `0.1.0` — backend feature-complete (TenantPolicy, RBAC, ExternalIdentifier done)
- `0.2.0` — ArcWallet API surface + credential offer flow done
- `0.3.0` — Vitest coverage ≥70% on core flows
- `1.0.0` — first real production deployment with a real tenant

Bump version in `package.json` at each milestone. Do not use `0.0.*` for
anything that ships to a real user.

---

## CLI (planned — not yet built)

The ArcID CLI (`arcid-cli`) will be a separate package in this repo under
`packages/cli/`. It will wrap the SDK to enable:
```bash
arcid login
arcid tenants list
arcid credentials issue --type UniversityDegree --subject <identityId>
arcid credentials verify <credential.jwt>
arcid tokens revoke <jti>
arcid webhooks events --status failed
arcid webhooks retry <eventId>
```
It authenticates using the same OAuth flow as ArcWallet (device code grant or
authorization code with PKCE). Add the `packages/cli/` workspace entry to
`pnpm-workspace.yaml` when building it:
```yaml
packages:
  - packages/*
```
Use `commander` or `@clack/prompts` for the CLI UX. Authenticate against
`ARCID_API_URL` from env. Output JSON by default, pretty-print with `--pretty`.

---

## SDK (existing — in `src/sdk/`)

The SDK in `src/sdk/` is the **frontend** HTTP client used by the Next.js
app. It is not a publishable npm package yet.

A **publishable npm SDK** is a future milestone — once the API surface is
stable at `0.2.0+`. When building it, extract to `packages/sdk/` and make it:
- Framework-agnostic (no Next.js, no Zustand, no React)
- TypeScript with full type exports
- ESM + CJS dual build
- Exports: `ArcIDClient`, all error types, all response types

---

## File naming conventions

- Flows: `<name>.flow.ts`
- Routes: `<name>.route.ts`
- Services: `<name>.service.ts`
- Repositories: `<name>.repository.ts`
- Validators: `<name>.schemas.ts`
- Presenters: `<name>.presenter.ts`
- Tests: `<name>.test.ts` (co-located)
- Hooks: `use-<name>.ts`
- Stores: `<name>.store.ts`
- SDK modules: `<name>.sdk.ts`

---

## Before writing any code, always check

1. Does a flow already exist for this operation? Check `src/modules/*/flows/`.
2. Does the Prisma model have all the columns needed? Check `prisma/schema.prisma`.
3. Does the route already exist? Check `src/modules/*/routes/` and
   `src/api/routes/`.
4. Is there an existing test in `docs/planning/testing-guide.MD` for this
   endpoint? Match the request shape exactly.
5. Does this operation need a TenantPolicy check? If the operation is
   tenant-scoped, ask: "should tenant admins be able to restrict this?"

---

## What NOT to do

- Do not import `prisma` inside a flow — use `ctx.db`.
- Do not put business logic in route handlers.
- Do not call `fetch()` on a user-supplied URL without `assertSafeUrl()`.
- Do not add a new policy field to `TenantPolicy` without also adding
  its enforcement in the relevant auth flow.
- Do not write `role.name === "ADMIN"` in a new route — use `requirePermission()`
  once RBAC is built.
- Do not use `request.identity.currentTenantId` — it does not exist.
  Use `request.identity.tenantId`.
- Do not hardcode algorithms in cryptographic operations — read from the
  key record or JWT header.
- Do not create a `0.1.0` release until TenantPolicy enforcement + RBAC are done.

// note that some changes might have taken place on the cause of creating this documnent, ensure to always udpate this file as changes take place and rewite the arcid-v1 roadmap file under our planning docs and replace the testing-guide doc also with an up to date version that fully respects our architecture --- this file is to know how our system looks and upgrate.... always update the arcid-v1-roadmap file as changes takes place.... as it is our main direction to know what's already built, whats already perfect or close to perfect... fully functional or needs redefinition....