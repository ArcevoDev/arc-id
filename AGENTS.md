# ArcID — Agent Instructions

> Loaded automatically every session by Command Code (and any other
> AGENTS.md-compliant agent). For the long-form handbook — status tables,
> rationale, and the open work queue — see `CLAUDE.md` in this same root.
> This file is the compressed, always-loaded version of those same rules.
> If the two ever disagree, `CLAUDE.md` is the source of truth; fix this
> file to match it, not the other way round.

## What this is

ArcID: sovereign multi-tenant identity/IAM backend. Fastify + Prisma + Next.js
16 monorepo. OAuth2/OIDC provider, WebAuthn passkeys, TOTP MFA, SD-JWT
Verifiable Credentials, did:web, multi-tenant policy/RBAC, webhook delivery.
Version `0.0.1` — pre-release, breaking changes expected, do not treat any
current shape as a stable contract.

Package manager is **pnpm**. Module system is **ESM only** (`"type": "module"`
in package.json) — never emit `require()`/`module.exports`.

## Non-negotiable architecture rules

1. **Business logic lives in Flows, never in routes.** `src/modules/<name>/flows/`.
   Routes (`routes/`) are thin: auth guard → validate → `FlowExecutor.execute()` → reply.
2. **Errors are always `ApiError` static helpers** (`ApiError.notFound(...)`,
   `ApiError.forbidden(...)`, `ApiError.invalidGrant(...)`, etc.). Never `throw new Error()`.
3. **DB access**: inside a flow, always `ctx.db` (transaction-scoped). Inside
   a route directly, `fastify.db`. Never `import prisma` inside a flow.
   Always use `select` projections — never fetch full rows for two fields.
4. **Auth guards** via `preHandler`: `fastify.auth.requireUser`,
   `requireAal2`, `requireElevated`, `requirePlan("PRO")`,
   `requireScope("credential:issue")`. `request.identity.tenantId` exists;
   `request.identity.currentTenantId` does **not** — never reference it.
5. **Module shape** — every domain module under `src/modules/<name>/` owns
   `flows/ routes/ services/ repositories/ validators/ presenters/`.
6. **Frontend never calls the API directly.** Chain is always
   `page/component → hook (use-*.ts) → Zustand store → SDK (src/sdk/*.sdk.ts) → API`.
7. **Tenant scoping**: every tenant-scoped query filters on `tenantId` taken
   from `req.params.tenantId` validated against membership — never trust
   `req.body.tenantId`.
8. **Security invariants**:
   - Any outbound fetch to a user-supplied URL passes through
     `assertSafeUrl()` (`src/lib/url-safety.ts`) first — no exceptions.
   - Access-token revocation always calls `blockJti` **and**
     `revokedJti.create` together — never one without the other.
   - New `TenantPolicy` fields must ship with their enforcement in the
     relevant flow in the same change — a policy field the UI can set but
     no flow reads is a silent no-op bug, not a partial feature.
   - Never hardcode a crypto algorithm (e.g. `"ES256"`) — read it from the
     key record or JWT header.

## File naming

`<name>.flow.ts` · `<name>.route.ts` · `<name>.service.ts` ·
`<name>.repository.ts` · `<name>.schemas.ts` · `<name>.presenter.ts` ·
`<name>.test.ts` (co-located with source) · `use-<name>.ts` (hooks) ·
`<name>.store.ts` · `<name>.sdk.ts`

## Testing

**Vitest** (already configured — `vitest.config.ts`, deps installed, `pnpm test`
scripts exist). There are currently **zero `*.test.ts` files in the repo** —
this is the actual blocker, not tooling setup. New/changed flows and services
need a co-located `*.test.ts`. Priority order for backfilling coverage:
`login.flow.ts` → `session.service.ts` → `token.service.ts` →
`jti-blocklist.ts` → `triggerKillChain` in `token-refresh.flow.ts`. Do not
write component/UI tests yet — backend correctness is the current priority.

## Before writing any code, check

1. Does a flow already exist for this? `src/modules/*/flows/`.
2. Does the Prisma model already have the columns needed? `prisma/schema.prisma`.
3. Does the route already exist? `src/modules/*/routes/`, `src/api/routes/`.
4. Is there a matching case in `docs/planning/testing-guide.MD`? Match the
   request shape exactly.
5. Is this tenant-scoped? If so, does it need a `TenantPolicy` check?

## Never do this

- Import `prisma` directly inside a flow.
- Put business logic in a route handler.
- Call `fetch()` on a user-supplied URL without `assertSafeUrl()`.
- Add a `TenantPolicy` field without wiring its enforcement.
- Write `role.name === "ADMIN"` in new code — RBAC (`hasPermission()` /
  `requirePermission()`) is on the open work queue; ask before adding another
  ad-hoc role check.
- Reference `request.identity.currentTenantId` — it does not exist.
- Cut a `0.1.0` release before TenantPolicy enforcement + RBAC land.
- Touch an already-applied migration file — new schema changes are always a
  new migration via `pnpm prisma:migrate`.

## Current priority queue

Live status, ranked work queue, and phase sequencing live in
`docs/planning/arcid-v1-roadmap.md` — read it before starting anything
larger than a single bug fix. It is the single source of truth for "what's
done, what's half-done, what's next." Keep it current: any session that
closes an item or discovers a new one updates that file in the same commit.
