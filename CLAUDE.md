# ArcID - Claude Code Handbook

> Verified against actual source on 2026-07-30. Do not trust claims from
> prior docs that aren't re-confirmed below - every status line here was
> checked against running tests or live source files, not old summaries.

---

## What ArcID is
   
ArcID is a sovereign, multi-tenant identity and access management backend.
Fastify + Prisma + Next.js 16 monorepo (pnpm, ESM-only).

**What it does today (0.1.0, pre-release):**
- Full OAuth 2.0 / OIDC provider - authorize, token exchange/refresh/revoke/introspect, JWKS, PKCE (mandatory by default)
- WebAuthn passkeys, TOTP MFA (setup/verify/recovery), magic-link auth, social login (Google/GitHub/Apple/Microsoft), SAML2 + OIDC federation
- SD-JWT Verifiable Credentials - issue/verify/revoke, W3C BitstringStatusList, did:web + did:key
- Presentation endpoint (challenge-response verification protocol) - jws-proof: 6 tests, verify-session: 5, verify-present: 9
- Multi-tenant: tenant CRUD + TenantPolicy (5 enforced fields) + RBAC (16 permissions, requirePermission()) + signing keys (KMS-encrypted)
- Webhook delivery engine (Postgres queue, FOR UPDATE SKIP LOCKED, retry/backoff, dead-letter)
- Rate limiting (per-route, per-IP), audit logging (40+ action enum values), JTI blocklist (Redis two-tier + DB fallback)
- KMS encryption for signing keys at rest (AES-256-GCM, key rotation script, encrypt/decrypt passthrough)
- Email via Resend (13 templates, React Email components, mail preview at :3000/mail/preview)
- SMS via Brevo (transactional SMS for MFA codes + security alerts)

**Test suite: 62 files / 340 tests / 0 code failures** - all passing clean, ~4-5 min runtime on Windows (route-level + Prisma import chains dominate). Updated 2026-08-12.

---

## Repository layout

```
arc-id/
├── src/
│   ├── api/           # Fastify server - plugins, routes, server entrypoints
│   │   ├── plugins/   # auth-guard, jwt, db, rate-limit, swagger, cors
│   │   ├── routes/    # well-known, health, DID document, mail-preview
│   │   └── server/    # build-server.ts, start-server.ts, start-workers.ts
│   ├── app/           # Next.js 16 App Router - dashboard + auth routes
│   ├── components/    # React components - auth forms + layout (in-repo)
│   ├── core/          # Shared: config, db, errors, flows, mail
│   ├── hooks/         # React hooks - use-*.ts over the facet SDKs
│   ├── jobs/          # Background jobs - token-cleanup, webhook-worker
│   ├── lib/           # Utilities: jwt, crypto, kms, security, url-safety
│   │   ├── kms/       # AES-256-GCM key encryption/decryption + rotation
│   │   ├── security/  # rbac, jws-proof, jti-blocklist, password-rules, login-attempt
│   │   └── webhooks/  # webhook-dispatcher (fan-out), webhook-worker (delivery)
│   ├── modules/       # 9 domain modules
│   │   ├── auth/      # login, register, MFA, passkey, magic-link, sessions, step-up, social
│   │   ├── audit/     # audit log write + query
│   │   ├── billing/   # subscription (Paystack/Stripe webhooks)
│   │   ├── credentials/ # DID, SD-JWT VC, issue/verify/revoke/offer, presentation
│   │   ├── identity/  # profile, delete-account, admin, delegation, external-ids, wallet-did
│   │   ├── idp/       # SAML2 + OIDC federation connections
│   │   ├── oauth/     # authorize, token, revoke, introspect, userinfo, clients, consent
│   │   ├── tenant/    # CRUD, policy, members, signing keys, projects, onboarding
│   │   └── webhooks/  # endpoint config + delivery event routes
│   ├── providers/     # React context - ThemeProvider, AuthProvider
│   ├── sdk/           # Thin singleton wiring over @arcevo/facet-sdk (index.ts only)
│   ├── store/         # Zustand stores - auth, tenant, ui
│   └── types/         # Shared TypeScript types
├── prisma/
│   ├── schema.prisma  # Single source of truth - 50+ models
│   ├── seed.ts        # SYSTEM tenant, admin user, 16 roles/permissions
│   └── migrations/    # Never hand-edit - always `pnpm prisma:migrate`
├── docs/planning/     # Planning documents
│   ├── arcid-v1-roadmap.md       # Operative roadmap
│   └── testing-guide.MD          # Manual API test matrix (65 checks)
├── .github/workflows/
│   ├── ci.yml         # PR push CI: lint, typecheck, test, build (api+web)
│   ├── deploy-api.yml # Fastify API deploy (GHCR push → SSH Docker Compose)
│   └── deploy-web.yml # Next.js deploy (SSH git pull → pnpm build:web → PM2)
├── AGENTS.md          # Loaded every session - compressed rules
└── CLAUDE.md          # ← you are here
```

---

## Running the project

```bash
pnpm install
pnpm prisma:migrate      # first time setup
pnpm seed                # SYSTEM tenant + admin

pnpm dev:all             # Next.js + Fastify API + background workers
pnpm dev:api             # Fastify only (port 4000)
pnpm dev:web             # Next.js only (port 3000)
pnpm dev:workers         # Background workers only

pnpm typecheck
pnpm lint
pnpm format
pnpm test                # 340 tests, 62 files, all passing
pnpm test:watch
pnpm test:coverage
pnpm build:api
pnpm build:web

### Docker deployment

```bash
# Build all images
docker compose build

# Start full stack (Postgres + Redis + API + workers)
docker compose up -d

# Run migrations (idempotent - runs automatically on container start)
docker compose run --rm api npx prisma migrate deploy --schema=prisma/schema.prisma

# Seed SYSTEM tenant + admin
docker compose run --rm api pnpm seed

# Tail logs
docker compose logs -f api

# Stop everything
docker compose down

# Full teardown (wipes volumes)
docker compose down -v
```
```

---

## Architecture rules - read before writing any code

### 1. Flows are the unit of business logic

Every multi-step operation lives in a `Flow` abstraction (`src/core/flows/flow.ts`):

```ts
interface Flow<I, O> {
  name: string;
  inputSchema: ZodSchema<I>;
  outputSchema?: ZodSchema<O>;
  execute(input: I, ctx: FlowContext): Promise<O>;
}
```

Flows execute via `FlowExecutor`, which wraps in a Prisma transaction and injects `db`, `identityId`, `tenantId`, `ip`, `requestId`.

### 2. Error handling

```ts
throw ApiError.notFound("Session not found");
throw ApiError.forbidden("Permission required: credential:issue");
throw ApiError.invalidGrant("Refresh token already used");
```

### 3. Database access

- Inside flows: `ctx.db` (transaction-scoped)
- Inside routes: `fastify.db`
- Never `import prisma` inside a flow
- Always use `select` projections - never fetch full rows for two fields

### 4. Auth guard patterns

```ts
preHandler: fastify.auth.requireUser;           // any authenticated user
preHandler: fastify.auth.requireAal2;           // MFA/passkey authenticated
preHandler: fastify.auth.requireElevated;       // recent step-up
preHandler: requirePermission("client:create"); // RBAC from src/lib/security/rbac.ts
```

Route-level patterns: `config: { rateLimit: { max: 10, timeWindow: "1 minute" } }`

### 5. Module structure

Every `src/modules/<n>/` owns: `flows/` `routes/` `services/` `repositories/` `validators/` `presenters/`

### 6. Security invariants - never break these

- **SSRF**: all outbound user-supplied URLs must pass through `assertSafeUrl()` (`src/lib/url-safety.ts`)
- **Token revocation**: always call `blockJti` AND `revokedJti.create` together
- **RBAC**: never write `role.name === "ADMIN"` - use `requirePermission()` from `src/lib/security/rbac.ts`
- **Federated login auto-link**: must check `emailVerified === true` on the existing identity
- **Crypto algorithm**: never hardcode - read from key record or JWT header via `decodeProtectedHeader`
- **Rate limiting**: every auth-sensitive route sets per-route `config: { rateLimit }`
- **CORS**: restrict to configured origins (`config.base.allowedOrigins`), not `"*"`
- **Current tenantId**: always `request.identity.tenantId` - never `request.identity.currentTenantId` (does not exist)

---

## Verified status - grounded in actual files and tests

### ✅ Done and solid - all verified against source

| Area | Status | Evidence |
|------|--------|----------|
| Auth engine (password, passkey, TOTP, magic-link, social, SAML) | ✅ 100% | `login.flow` (11 tests), `register.flow` (6), `session.service` (12), `passkey-register.flow` (5), `idp.service` (3) |
| OAuth 2.0 / OIDC | ✅ 100% | `token.service` (6), `token-refresh.flow` (9), refresh rotation + kill-chain + expiry vs replay fix |
| PKCE enforcement | ✅ 100% | Mandatory default, exchange-time defense-in-depth |
| JTI blocklist (Redis + DB fallback) | ✅ 100% | `jti-blocklist.*` (14 tests across 3 files) |
| SSRF defense | ✅ 100% | `url-safety` (7 tests), applied on webhooks + IdP metadata URLs |
| Webhook delivery | ✅ 100% | `webhook-config.route` (6 tests), Postgres queue, retry/backoff |
| SD-JWT VC issuance/verify/revoke | ✅ 100% | `verify-credential.flow` (3), `status-list.service` (5), CAS allocation |
| BitstringStatusList | ✅ 100% | `status-list.service.test.ts` - `allocateIndex` with CAS + retry |
| did:web + did:key | ✅ 100% | `provision-tenant-did.flow` (4), `did.route.test` (3), `register-wallet-did.flow` (created) |
| Redis-backed distributed revocation | ✅ **100%** | jti-blocklist (3 files/14 tests): in-memory Map fallback, retries every call. Introspect route: Redis + DB dual check. Login-attempt: no permanent init cache. **Per-session access token revocation**: `AccessToken.sessionId` column added + migration + `DELETE /sessions/:id` now revokes bound access tokens and blocks their JTIs in Redis. Full kill chain: session → refresh tokens → access tokens. |
| Presentation endpoint | ✅ 100% | `jws-proof` (6), `verify-session.route` (5), `verify-present.route` (9) - **20 tests total** |
| Credential offers | ✅ 100% | `offer-credential.flow` (8) + `offer.route` (5) = **13 tests** |
| Multi-tenant CRUD | ✅ 100% | `create-tenant.flow` (7), `add-member.flow` (2), policy enforcement |
| TenantPolicy enforcement | ✅ 5/5 fields | requireMfa, maxSessionsPerUser, sessionTtlMinutes, allowedEmailDomains, allowPasskeys |
| RBAC (requirePermission) | ✅ 100% | `rbac` (5 tests), 16 permissions, 0 `role.name === "ADMIN"` in new code |
| ExternalIdentifier | ✅ 100% | `link/list/unlink` (9 tests), SHA-256 hashed |
| Wallet + identity-owned DID | ✅ 100% | `register-wallet-did.flow` - did:key + Wallet row in same tx |
| KMS (signing key encryption) | ✅ Wired | `kms` (13 tests), called by `key-encryption.ts` → `signing.service.ts` + `provision-tenant-did.flow.ts` |
| Phase 0 bug fixes | ✅ All 7 | Variable alg header, non-custodial DID signing, status-list CAS, email gate, ADMIN_PASSWORD guard, migration folder rename, multibase encoding |
| `aal` in access + id tokens | ✅ 100% | `token.service` (6 tests including aal claim) |
| `preferred_username` in id_token | ✅ 100% | Verified in `token.service.ts` line 183 + test assertion |
| `setUsernameFlow` route | ✅ 100% | Registered in `auth.plugin.ts`, audit-logged, TOCTOU-safe |
| Refresh token expiry vs replay | ✅ Fixed | `token-refresh.flow.ts` Step 2b: expired → clean "re-authenticate", revoked → kill-chain. Tested (9 tests) |
| Email templates | ✅ 13 templates | All registered in `notification.service.ts`, compiled via React Email + Resend |
| CI pipeline | ✅ 3 workflows (rewritten 2026-07-28) | `ci.yml` (self-hosted Postgres 17 service, no external DB), `deploy-api.yml` (GHCR push → SSH Docker Compose on target VM), `deploy-web.yml` (SSH git pull → pnpm build:web → PM2 restart) |
| `GET /tenants` route | ✅ 100% | `list-tenants.route.ts` - returns all tenants the user has ACTIVE membership in, with role + plan |
| SDK layer | ✅ **Migrated to `@arcevo/facet-sdk@1.1.0`** | `src/sdk/` is now `index.ts` only - an `ArcIdClient` singleton (401 auto-refresh wired to the Zustand auth store) re-exporting the facet domain SDK classes (`AuthSdk`, `TenantSdk`, `VcSdk`, …). Old factory-pattern `src/sdk/*.sdk.ts` deleted (2026-08-05). |
| UI components | ✅ **Migrated to `@arcevo/facet-components@1.5.0`** | `src/components/ui/` deleted; all consumers import from the facet package. Icons use the package's native `<Icon name="…" />` registry (`getIcon`/`lucideIconMap`); `src/lib/ui/icon-registry.ts` + `navigation.ts` deleted as duplicates. `cn` re-exported from `@/lib/utils`. Verified typecheck + 340 tests green (2026-08-14). |
| Auth UI | ✅ **Migrated to `@arcevo/facet-auth@1.1.4`** | Login/register/mfa pages use `SignIn`/`SignUp`/`MfaDialog`; `ArcProvider` bridged to the Zustand store via `zustandTokenStorage` (commit `d6f6707`). In-repo `login-form`/`register-form`/`mfa-form` deleted; forgot/reset forms remain. |
| Layout | ✅ **Migrated to `@arcevo/facet-layout@1.3.1`** | `(auth)` group uses `AuthLayout`, `(dashboard)` group uses `ConsoleLayout`; in-repo sidebar/topbar/tenant-switcher deleted. |
| CSS tokens | ✅ **Migrated to `@arcevo/facet-tokens@1.1.0`** | `tokens.css` imported before `globals.css` in `layout.tsx`; `:root` block removed from globals.css; arc-id keeps its indigo primary via override. |
| Tenant store hydration | ✅ Wired | `AuthProvider` calls `tenants.list()` on mount, populates `useTenantStore` with enriched tenant data |
| Tenant switcher UI | ✅ Built | `TenantSwitcher` component in Topbar - visible when user has 2+ tenants, triggers context switch |

### 🔴 NOT started - the actual work queue

| Priority | Item | Why now |
|----------|------|---------|
| **P0** | Facet migration Phases 4–6 | **Phases 1–5 done (2026-08-14).** Phase 1: `src/sdk/` is a thin `ArcIdClient` singleton wiring over `@arcevo/facet-sdk@1.1.0`. Phase 2: `@arcevo/facet-tokens/tokens.css` imported before `globals.css` in `layout.tsx`. Phase 3: `src/components/ui/` deleted - all consumers import `@arcevo/facet-components@1.5.0`. Phase 4: auth pages on `@arcevo/facet-auth@1.1.4` via `ArcProvider` + `zustandTokenStorage` bridge (commit `d6f6707`). Phase 5: layouts on `@arcevo/facet-layout@1.3.1`. **Remaining:** Phase 6 purge - only `forgot-password-form`/`reset-password-form` still in-repo (in use). |
| **P1** | Phase 3 - Security hardening | **✅ Closed (2026-07-28).** SSRF (4/4 fixed), CSRF review complete, Redis-backed distributed revocation wired. **Per-session access token revocation**: `AccessToken.sessionId` column + migration + `DELETE /sessions/:id` revokes bound access tokens + blocks JTIs in Redis. Full kill chain: session → refresh → access tokens. JTI blocklist (14 tests, 3 files): in-memory Map fallback, retries every call. Introspect route: Redis + DB dual check. |
| **P2** | Phase 4 - Observability | **✅ Shipped (2026-07-28).** `requestId` in all error responses + audit log metadata. `@fastify-metrics` at `GET /metrics`. Correlation IDs flow through FlowContext.requestId → auditService.log → DB. Pino structured logs carry traceId on every flow init/ok/fail. |
| **P3** | CLI + SDK packages | `packages/cli/` extraction after frontend rebuild stabilises API contract. Design basis: `docs/planning/arcid-cli-design.md`. |
| **P4** | LegalConsent → wire to flow | Schema-only today - needs a consumer |
| **P5** | ExternalIdentifier.verified → VC issuance | `issue-credential.flow.ts` doesn't resolve `subjectDid` → `Identity` yet |

### 🔶 Deferred (do not start early)

- BBS+/selective disclosure beyond SD-JWT - SD-JWT VC is correctly implemented now
- `did:jwk` - `did:key` is sufficient for wallet-originated DIDs
- Full OIDC4VCI/OIDC4VP - revisit when ArcWallet is live and external consumers exist
- OPA/Cedar policy engine, SCIM, Terraform provider - all v2+
- Identity-scoped signing key (non-custodial by design - abandoned per architecture decision)

---

## Test coverage detail

### 62 test files, 340 tests - modules with coverage

> All 62 files pass on `pnpm test`. Typecheck clean (`tsc --noEmit`).

| Module | Test files | Tests | Source files | Coverage breadth |
|--------|-----------|-------|-------------|-----------------|
| `auth` | 14 | 76 | 38 | All 13 flows covered (login, register, logout, email-verify, magic-link, mfa-setup/verify, passkey-register/auth, password-reset-request/confirm, set-username, switch-context) + session.service + `session.route` (DELETE /sessions/:id - 3 tests) |
| `credentials` | 7 | 55 | 20 | Issue/verify/offer/revoke flows + route-level (offer, verify-session, verify-present) + status-list service |
| `oauth` | 6 | 47 | 21 | authorize.flow, token-exchange.flow, token-refresh.flow, token-revoke.flow, revoke-token-by-id.flow + token.service |
| `tenant` | 7 | 27 | 22 | create-tenant, add-member, remove-member, provision-tenant-did + did.route + cross-tenant-isolation (HTTP + unit) |
| `identity` | 6 | 24 | 20 | register-wallet-did, delete-account, update-profile, link/list/unlink-external-id |
| `idp` | 1 | 3 | 4 | federatedLogin service |
| `billing` | 1 | 11 | 5 | subscription.route (Paystack + Stripe webhooks) |
| `audit` | 1 | 3 | 7 | query-audit-logs flow |
| `webhooks` | 1 | 6 | 4 | webhook-config route |
| `lib/*` | 8 | 55 | ~15 | url-safety, rbac, password-rules, jws-proof, jti-blocklist (3 files, inc. Redis), kms |
| `test-utils` | 2 | 5 | 2 | test-infra + sanity |
| `sdk` | 1 | 4 | 1 | `src/sdk/index.ts` singleton wiring over `@arcevo/facet-sdk` - exports + client token round-trip |
| `root` | 1 | 1 | - | root sanity test |

### Modules with zero test coverage (14 files, all low-to-medium risk)

| File | Risk | Notes |
|------|------|-------|
| `auth/services/mfa.service.ts` | Medium | Tested indirectly via mfa-setup.flow.test + mfa-verify.flow.test (11 tests combined) |
| `auth/services/passkey.service.ts` | Medium | Tested indirectly via passkey-register.flow.test + passkey-authenticate.flow.test (11 tests) |
| `auth/services/password.service.ts` | Low | Thin argon2 wrapper, tested via register + login flows (17 tests) |
| `auth/services/step-up.service.ts` | Low | Elevation logic tested via mfa-verify + switch-context flows |
| `credentials/services/signing.service.ts` | Medium | SD-JWT dispatcher, tested via issue-credential.flow.test (12 tests) |
| `credentials/services/did.service.ts` | Low | did:web construction, tested via did.route.test + provision-tenant-did.flow.test |
| `identity/routes/admin.route.ts` | Medium | Identity status management, SYSTEM-ADMIN gated |
| `identity/routes/profile.route.ts` | Low | Tested via update-profile + delete-account flows |
| `identity/routes/delegation.route.ts` | Low | Simple CRUD |
| `tenant/services/membership.service.ts` | Low | Tested via add-member + remove-member flows |
| `tenant/services/onboarding.service.ts` | Low | Tenant onboarding |
| `tenant/services/project.service.ts` | Low | Tested via create-tenant flow |
| `tenant/services/tenant.service.ts` | Low | Tested via create-tenant flow |
| `webhooks/routes/webhook.route.ts` | Low | Inbound ingestion endpoint (webhook-config.route.test covers config only) |

### Security gaps (unverified or missing)

| Check | Status | Detail |
|-------|--------|--------|
| Cross-tenant isolation (HTTP + unit) | ✅ **Verified** | `cross-tenant-http.test.ts` - 3 HTTP-layer tests. `cross-tenant-isolation.test.ts` - 3 flow-level unit tests (mock fixed: `upsert`/`findMany`/`findUniqueOrThrow` + `auditLog.create`). All 6 tests pass clean with no audit-noise errors. |
| Rate limiting per route | ✅ Verified | Every auth-sensitive route has `config: { rateLimit }` - login (10/min), register (5/hr), magic-link (3/15min), MFA (5/5min), password (5/15min), step-up (5/5min), verify-session (30/min), verify-present (30/min) |
| Audit logging - called actions | ⚠️ Partial (2 missing call sites fixed) | 40 enum values in schema. Verified call sites exist for 38/40 (exhaustive grep 2026-07-28). Only truly unused: `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_ASSIGNED` (no RBAC admin UI yet), `OAUTH_CLIENT_UPDATED` (no PUT/PATCH endpoint exists). `PASSWORD_RESET_REQUESTED` audit call was missing - added. `magic-link.flow.ts` had zero audit calls - `SESSION_CREATED` + `USER_LOGIN_SUCCESS` added. |
| Secrets/PII in logs | ⚠️ **Unverified** | No automated scan for plaintext credentials in log statements |
| CORS config | ✅ Verified | Restricted to `config.base.allowedOrigins` (env-driven), not wildcard |
| Token revocation (blockJti + revokedJti) | ✅ **Verified** | Both called together in all revoke paths. Introspect route now checks Redis + DB (was DB-only). |
| JTI blocklist - in-memory fallback | ✅ **Verified** | `jti-blocklist.ts`: in-memory `Map` with TTL expiry, retries Redis every call (no permanent `_initFailed`). Matches `challenge-store.ts` pattern. 14 tests across 3 files. |
| Login-attempt - no permanent init cache | ✅ **Fixed** | `login-attempt.ts`: removed `_initFailed`, retries Redis every call. Same pattern as `challenge-store.ts`. |
| SSRF allowlist (network-level) | ✅ **Verified** | `assertSafeUrl()` already has full network-layer private-IP blocks (RFC1918, loopback, link-local, CGNAT, IPv6 ULA) + DNS rebinding defence + `fetchWithSsrfGuard` redirect protection - verified 2026-07-26 |
| CSRF protection | ✅ **Verified** | Only cookie-mutating routes are OAuth state cookies in `social.route.ts` - all `sameSite: "lax"` + `httpOnly` + `secure` + 600s TTL + cleared after use. All other routes return tokens in JSON body (no cookies). CORS restricted to `config.base.allowedOrigins`. |
| Docker compose | ✅ **Exists** | `docker-compose.yml` - 4 services (postgres 17-alpine, redis 7-alpine, api, workers) with health checks + mem limits |
| Integration tests against real Postgres | 🔶 **P3 - deferred until facet ships** | All tests are unit/mock-level with `createMockDb`. SDK tests (73) run against `fastify.inject()` with mock DB, covering the full API surface. Real Postgres integration tests deferred - would need `testcontainers` or enhanced CI service container config |
| Migration rollback test | ❌ **Does not exist** | No prisma:migrate-down or rollback testing |
| Dependency/secret scanning in CI | ❌ **Not in CI** | CI.yml has lint/typecheck/test/build, no trivy/snyk/secret-scan |
| Production Dockerfile | ✅ **Exists** | Multi-stage (deps → builder → runner), node:22-alpine, auto-migrate entrypoint, 150MB |

---

## Versioning

Current: `0.1.0` (package.json). Pre-release - no stability promises.

- `0.1.0` (current) - Backend complete: all Phase 0–4 shipped; 62 test files / 340 tests, 0 code failures
- `0.2.0` - Frontend rebuilt, ArcWallet integration working end-to-end
- `1.0.0` - Stable production-ready milestone with Phase 3+4 hardening

---

## Mail templates - full inventory

13 templates in `src/core/mail/templates/`, all registered in `src/lib/notifications/notification.service.ts`:

| Template | Trigger | Wire call site |
|----------|---------|----------------|
| WelcomeMail | Post-email-verification | register.flow.ts |
| VerifyEmailMail | Registration | notification service |
| MagicLinkMail | Magic link request | auth service |
| PasswordResetMail | Password reset request | auth service |
| PasswordChangedMail | Password changed | auth service |
| MfaCodeMail | MFA verification code | auth service |
| RecoveryCodesIssuedMail | MFA setup complete | auth service |
| MfaDisabledAlertMail | MFA disabled | mfa-setup.flow.ts |
| NewDeviceLoginMail | New device sign-in | auth service |
| AccountSuspendedMail | Account suspended | admin.route.ts |
| AccountDeletionMail | Account deleted | delete-account.flow.ts |
| TenantInviteMail | Tenant member added | add-member.flow.ts |
| CredentialIssuedMail | Credential issued | issue-credential.flow.ts |

**No gaps** - every common auth/billing email type is covered.

SMS: transactional MFA codes + security alerts via Brevo (`sendMfaCodeSms`, `sendSecurityAlertSms`).

---

_Keep this file current. Any session that closes an item or discovers a new one
updates CLAUDE.md and arcid-v1-roadmap.md in the same commit._
a new one
updates CLAUDE.md and arcid-v1-roadmap.md in the same commit._
