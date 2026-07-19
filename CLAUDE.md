# ArcID — Claude Code Handbook

> This file is read by Claude Code (claude.ai/code) before touching anything.
> It is the single source of truth for how to work on this project.
> Keep it updated as the codebase evolves.

---

## What ArcID is

ArcID is a sovereign, multi-tenant identity and access management backend built to solve identity fragmentation in the Nigerian and broader African digital ecosystem. The long-term goal is a single canonical identity that a person carries across sectors — government, healthcare, education, finance, agriculture.

Right now it is a **Fastify + Prisma + Next.js monorepo** that provides:

- Full OAuth 2.0 / OIDC provider (authorize/token/refresh/revoke/introspect/JWKS)
- WebAuthn passkeys + TOTP MFA + magic link + social/SAML federation
- SD-JWT Verifiable Credentials + W3C BitstringStatusList revocation + did:web
- Multi-tenant architecture with per-tenant policy, roles, and signing keys
- Webhook delivery engine (Postgres-backed `FOR UPDATE SKIP LOCKED`)
- Admin dashboard (Next.js 16, Tailwind, shadcn/ui, Zustand)

Version is `0.0.*` (pre-release, pre-deployment). Versioning scheme is semver starting from `0.0.1` — no breaking-change promises yet.

---

## Repository layout

```
arc-id/
├── src/
│   ├── api/          # Fastify server — plugins, routes, server entrypoints
│   │   ├── plugins/  # auth-guard, jwt, db, rate-limit, swagger
│   │   ├── routes/   # well-known, health, DID document, mail-preview
│   │   └── server/   # build-server.ts, start-server.ts, start-workers.ts
│   ├── app/          # Next.js 16 App Router pages
│   │   ├── (auth)/   # login, register, MFA, passkey, password reset
│   │   └── (dashboard)/ # admin UI pages
│   ├── components/   # React components (arc/, layout/, shared/, ui/)
│   ├── core/         # Shared fundamentals — config, db, errors, flows, mail
│   ├── hooks/        # React hooks (use-auth, use-sessions, use-passkeys, …)
│   ├── jobs/         # Background jobs — token-cleanup, webhook-worker
│   ├── lib/          # Pure utilities — jwt, crypto, security, url-safety
│   ├── modules/      # Domain modules — each owns routes/flows/services/repos
│   │   ├── auth/         # login, register, MFA, passkey, magic-link, sessions
│   │   ├── billing/      # subscription, upgrade, webhook verification
│   │   ├── credentials/  # DID, SD-JWT, VC issuance/revocation/verify
│   │   ├── identity/     # profile, delegation, external identifiers, admin
│   │   ├── idp/          # SAML2 + OIDC federation
│   │   ├── oauth/        # authorize, token exchange/refresh/revoke, introspect
│   │   ├── tenant/       # tenant CRUD, policy, members, signing keys, projects
│   │   ├── audit/        # audit log writes and read routes
│   │   └── webhooks/     # webhook endpoint config + delivery event routes
│   ├── providers/    # React context providers (auth, theme)
│   ├── sdk/          # Frontend HTTP client — one file per domain
│   ├── store/        # Zustand stores (auth, tenant, ui)
│   └── types/        # Shared TypeScript types
├── prisma/
│   ├── schema.prisma # Single source of truth for the data model
│   ├── seed.ts       # Dev/staging seed — creates SYSTEM tenant, admin, roles
│   └── migrations/   # Never hand-edit; always `pnpm prisma:migrate`
├── docs/planning/    # Planning documents — read before big changes
│   ├── arcid-v1-roadmap.md   # THE operative roadmap
│   ├── ARCID_PROGRESS.md     # Phase-by-phase status tracker
│   └── testing-guide.MD      # Full API test matrix
└── CLAUDE.md         # ← you are here

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

**Vitest is installed and in use** — `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` all work cleanly out of the box. 21 functional test files are actively running, covering core areas like authentication flows, session limits (including `sessionTtlMinutes` and `maxSessionsPerUser` automatic evictions), the token service layout, tenant isolation limits, and tiered subscription updates. Remaining testing priorities focus entirely on test depth across missing logic gates rather than framework implementation details.

---

## Architecture rules — read before writing any code

### 1. Flows are the unit of business logic

Every multi-step operation lives inside a `Flow` abstraction layout (`src/core/flows/flow.ts`):

```ts
interface Flow<I, O> {
  name: string;
  inputSchema: ZodSchema<I>;
  outputSchema?: ZodSchema<O>;
  execute(input: I, ctx: FlowContext): Promise<O>;
}
```

Flows execute strictly via a managed `FlowExecutor` block that wraps tasks within an elegant Prisma transaction layer, auto-injecting vital context fields like `db`, `identityId`, `tenantId`, `ip`, and unique execution `requestId`. **Never inject core business logic handling directly inside route structures.** Routes remain as lean controllers passing valid requests straight to the executor.

### 2. Error handling

Always throw descriptive `ApiError` static wrapper objects. Avoid throwing native engine errors.

```ts
throw ApiError.notFound("Session not found");
throw ApiError.forbidden("Permission required: credential:issue");
throw ApiError.invalidGrant("Refresh token already used");
```

Leverage explicit OAuth error mapping equivalents conforming to RFC 6749 where required (e.g., `invalidGrant`, `invalidClient`).

### 3. Database access

- Inside running Flows: Always extract the scoped client reference via `ctx.db`.
- Straight from routing middleware: Read directly from `fastify.db`.
- **Never pull global instances directly into execution logic.**
- Explicitly enforce tight database projections through clean `select` instructions rather than extracting full structural rows.

### 4. Auth guard patterns

Declare precise route guards via sequential `preHandler` hooks:

```ts
preHandler: fastify.auth.requireUser; // any authenticated user
preHandler: fastify.auth.requireAal2; // MFA/passkey completed
preHandler: fastify.auth.requireScope("credential:issue");
```

Use `request.identity.tenantId` explicitly when retrieving isolation IDs.

### 5. Module structure

Every logical boundary within `src/modules/<name>/` strictly scopes its ownership using this folder layout pattern:

- `flows/` -> Scoped business operations.
- `routes/` -> Minimal HTTP router layers.
- `services/` -> Dedicated execution engines (`SessionService`, etc.).
- `repositories/` -> Targeted DB data access blocks.

### 6. Security invariants — never break these

- **SSRF Mitigation:** All dynamic, user-provided outbound connections require explicit routing via `assertSafeUrl(url)` from `src/lib/url-safety.ts` before triggering fetches.
- **Token Invalidation:** Executing an individual token invalidation mandates calling both `blockJti` and `revokedJti.create` in a uniform, non-breaking execution pass.

---

## Current status

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

### ⚠️ TenantPolicy enforcement — 3 of 4 fields done

- ✅ `requireMfa` — enforced in the login path, tested
- ✅ `maxSessionsPerUser` — enforced in `session.service.ts`, tested
- ✅ `sessionTtlMinutes` — enforced in `session.service.ts`, tested
- ❌ `allowedEmailDomains` — schema + validator exist, `register.flow.ts` never reads it. A tenant admin can set this in the UI and it silently does nothing. Fix this before 0.1.0.
- ❌ `allowPasskeys` — schema + validator exist, no passkey route checks it. Same silent no-op as above. Fix this before 0.1.0.

### ✅ KMS — done

`kms.encrypt()`/`kms.decrypt()` are fully implemented and actively serving production cryptographic workflows for our signing-key storage infrastructure.

### ❌ Open — the actual work queue, in priority order

**Immediate (1-3 days each):**

1. **Finish TenantPolicy Enforcements:** Connect `allowedEmailDomains` properly into your registration handling logic and ensure `allowPasskeys` restricts entry blocks on registration and signature verification modules. Mirror the existing test configurations built out for session evictions.
2. **Implement RBAC Layout:** Establish `src/lib/security/rbac.ts` containing concrete `hasPermission()` / `requirePermission()` validations. Seed necessary schema matrices to cleanly shift all 16 loose structural checks away from fragile `role.name === "ADMIN"` strings.
3. **✅ ExternalIdentifier Architecture:** `POST/GET/DELETE /identity/external-ids` implemented (3 flows, 3 routes, 3 test files, 9 tests). Self-service linking with SHA-256 value hashing. `displayValue` surfaced for UI; `valueHash` never returned. `verified` always `false` at creation.
4. **Wire ExternalIdentifier.verified to VC issuance:** `issue-credential.flow.ts` doesn't currently resolve `subjectDid` to an Identity, so it can't check or update `ExternalIdentifier` rows. Until then, `verified` is user-facing metadata only, not a security guarantee. Needs schema analysis of `subjectDid → Identity` resolution path and a flow that marks identifiers as verified upon successful VC issuance.

**Deferred until 0.1.0 ships (do not start early):** 5. **CredentialOffer Setup:** Introduce targeted migrations handling structural credential issuance models alongside baseline presentation entryways explicitly scoped for downstream `0.2.0` releases.

---

## Testing strategy

**Framework:** Vitest (ESM-native, fast, matching project specifications).

**Where tests live:** `src/**/*.test.ts` co-located with source files.

**Coverage Gaps to Complete (Targeting ≥70% Core Flow Coverage for 0.3.0):**

- Dynamic RBAC matching structures (once written).
- Cross-sector identity linking pipelines within `ExternalIdentifier` flows.
- Extended token validation strategies inside OAuth introspection edge cases.
- Failure loops, error decay, and retry backoff mechanics within background workers.

---

## Versioning

Current: `0.0.1` (Clean, accurate tracking base).

Scheme:

- `0.0.*` — Pre-deployment development state; breaking signature changes expected.
- `0.1.0` — Core multi-tenant backend feature parity reached (Policies, RBAC, Identifiers completed).
- `0.2.0` — Wallet issuance endpoints fully operational.
- `1.0.0` — Stable production-ready deployment milestone.

---

_Note: As active adjustments surface during feature development, immediately write updates down here while explicitly clarifying target execution milestones within `docs/planning/arcid-v1-roadmap.md` to keep our automated context systems fully in sync._
