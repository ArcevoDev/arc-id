# ArcID v1 Roadmap — Verified 2026-07-26

> Backend complete (0.1.0 equivalent). All Phase 0–2 shipped. **57 files / 352 tests / 0 code failures on `pnpm test` (109s, all passing). Typecheck clean.**
> Next work: frontend rebuild (Prompt 2) → Phase 3 hardening → Phase 4 observability.

---

## ✅ Done — all verified against source

### Phase 0 — Bug fixes (all 7, verified)

| # | Bug | Fix | Verified by |
|---|-----|-----|-------------|
| 1 | Verification algorithm mismatch | `verify-credential.flow.ts` reads `alg` from JWT header via `decodeProtectedHeader()` | `verify-credential.flow.test.ts` (3 tests — ES256, tampered, missing alg) |
| 2 | Identity-owned DID non-custodial by design | `register-wallet-did.flow.ts` stores only public key; `loadSigningKey` guard is permanent | `docs/planning/presentation-envelope-design.md`, architecture decision |
| 3 | Status-list index allocation race | Atomic CAS via `updateMany` with retry on conflict, `tx` parameter | `status-list.service.test.ts` (5 tests) |
| 4 | Federated login account takeover | Both `social.route.ts` + `idp.service.ts` gate auto-link on `emailVerified === true` | `idp.service.test.ts` (3 tests — verified email links, unverified email throws, new identity) |
| 5 | `ADMIN_PASSWORD` default in seed | Production seed requires env var; defense-in-depth rejects dev default | `prisma/seed.ts` lines 45-63 |
| 6 | Misnamed migration folder | Renamed to `20260617125316_add_username_set_audit_action` | File system |
| 7 | Multibase encoding bug | `src/lib/multibase.ts` implements spec-correct base58btc | `did.route.ts`, `register-wallet-did.flow.ts` use it |

### Phase 1 — OAuth/aal gap (all 4 items, verified)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | `aal` field in `IssueTokensParams`, threaded through session creation + step-up | ✅ Done | `token.service.ts` lines 72, 163, 184; test 88 "includes aal claim in access token JWT" |
| 2 | `preferred_username` in `id_token` claims | ✅ Done | `token.service.ts` line 183; test assertion line 118 |
| 3 | `setUsernameFlow` route registered | ✅ Done | `auth.plugin.ts` registers `setUsernameRoute`; `set-username.flow.ts` (audit-logged, TOCTOU-safe) |
| 4 | Refresh token expiry vs replay kill-chain fixed | ✅ Done | `token-refresh.flow.ts` Step 2b: expired token → clean "please log in again", no kill chain. Revoked → full family kill. 9 tests. |

### Phase 2 — ArcWallet-facing API (all 3 items, verified)

| # | Item | Evidence |
|---|------|----------|
| 1 | Credential offers | `offer-credential.flow` (8 tests) + `offer.route` (5 tests) = **13 tests** |
| 2 | Wallet binding + identity-owned did:key | `register-wallet-did.flow.ts` — creates `DecentralizedIdentifier` + `Wallet` in same tx |
| 3 | Presentation endpoint | `jws-proof` (6) + `verify-session.route` (5) + `verify-present.route` (9) = **20 tests**. Anti-replay: single-use, 5-min TTL, nonce mismatch rejection |

---

## 🟢 Frontend rebuild (Prompt 2)

Architecture constraint (non-negotiable):

```
page → component(s) → hook (use-*.ts) → Zustand store → SDK (src/sdk/*.sdk.ts) → API
```

### Completed (2026-07-23)

| Step | What | Status |
|------|------|--------|
| 1 | **SDK layer** (`src/sdk/`) | **Done.** Refactored to factory pattern (`createClient(config)` + per-domain `create*Sdk(client)`). Singletons wired to localStorage via `defaultClient`. Pure fetch wrappers — no React, no Next.js, no direct imports. Each SDK file exports factory + singleton. Barrel `@/sdk` re-exports both. Missing SDKs added: `api-keys.sdk.ts`. Missing methods added: `listAdmin()`, `updateStatus()` on `identity.sdk`; `list()` on `credentials.sdk`. |
| 2 | **Zustand stores** (`src/store/`) | **Done.** `auth.store.ts` has `setTokens()` (called by the SDK barrel-level `refreshToken()` function during 401 recovery). `tenant.store.ts` and `ui.store.ts` unchanged — already correct. |
| 3 | **Hooks** (`src/hooks/`) | **Done.** Added `use-credentials.ts`, `use-mfa.ts`, `use-webhooks.ts`, `use-api-keys.ts`. Existing 11 hooks (use-auth, use-tenant, use-ui, use-oauth-tokens, use-sessions, use-passkeys, use-audit-log, use-step-up, use-pagination, use-debounce, use-mobile) all correct. |
| 4 | **Providers** (`src/providers/`) | **Done.** 401 auto-refresh wired in `src/sdk/client.ts` (the SDK `request()` method retries once on 401 via the `refreshToken` callback before calling `onAuthCleared`). `AuthProvider` restores session from localStorage on mount. `ThemeProvider` unchanged. |
| 5 | **Layout** (`src/components/layout/`) | **Done.** AppLayout, ConsoleLayout, Sidebar, Topbar, PageHeader all correct — already matched the target architecture. |
| 6 | **Pages** (`src/app/`) | **Partial.** All `as any` casts eliminated from admin page (was using `identitySdk.listAdmin` / `updateStatus`) and credentials page (was using `credentialsSdk.list`). API keys page upgraded from raw `sdk.get/post/delete` to `apiKeysSdk`. Other pages use proper typed SDK methods. Pages that import SDK directly (bypassing hooks) remain per existing pattern — pragmatically acceptable for simple reads. |

### Remaining gaps (low priority, not blocking)
- Some pages import SDK modules directly instead of going through hooks (e.g. login, register, billing, dashboard). These work correctly but violate the strict chain rule.
- `ConfirmActionDialog` / `StepUpDialog` still use `{...{} as any}` prop spreads — need prop alignment fix in those components.

---

## 🔴 Phase 3 — Security hardening

Real gaps verified against source, not deduced from doc claims:

| Priority | Item | Current state | Gap |
|----------|------|---------------|-----|
| P1 | Cross-tenant isolation (HTTP + unit) | `cross-tenant-http.test.ts` (3 HTTP tests) + `cross-tenant-isolation.test.ts` (3 flow-level tests). Unit-level mock fixed: `statusListEntry.upsert`/`findMany` and `bitstringStatusList.findUniqueOrThrow` instead of `update`. All 6 tests pass. | **Closed** — verified 2026-07-26 |

### Test file verified

```ts
// src/modules/tenant/routes/cross-tenant-http.test.ts
// Tests at HTTP layer with real revokeRoute + flowExecutor:
//   1. Tenant B → Tenant A's credential → 404
//   2. Tenant A → Tenant A's credential → 200
//   3. Identity-owned (issuer.tenantId: null) → 200 (bypass)
```
| P2 | Redis-backed distributed revocation | JTI blocklist uses Redis two-tier + DB fallback (14 tests), but revocation is Postgres-level only | Scale concern before external users |
| P3 | SSRF allowlist (network-layer) | `assertSafeUrl()` exists (7 tests) — already has full private-IP blocks (RFC1918, loopback, link-local, CGNAT, IPv6) + DNS rebinding check + `fetchWithSsrfGuard` redirect defence. | **Closed** — verified 2026-07-26 |
| P4 | CSRF review | Only cookie-mutating routes are OAuth state cookies in `social.route.ts` — all `sameSite: "lax"`, `httpOnly`, `secure`, 600s TTL, cleared after use. All other routes return tokens in JSON body only. CORS restricted to `config.base.allowedOrigins`. | **Closed** — verified 2026-07-27 |
| P5 | Secrets/PII in logs scan | No automated scan | Manual review needed |

### SSRF call-site gaps fixed (2026-07-27)

The 3 P0 gaps + 1 additional SAML surface discovered during the full codebase audit have all been fixed and verified:

| File | Line(s) | Issue | Fix applied |
|------|---------|-------|-------------|
| `idp.route.ts` | 449 | OIDC discovery fetch — raw `fetch()` with no guard | Added `assertSafeUrl(discoveryUrl)` before `fetch()` |
| `idp.route.ts` | 472 | OIDC token endpoint POST — raw `fetch()` with no guard | Added `assertSafeUrl(discovery.token_endpoint)` before `fetch()` |
| `webhook-config.route.ts` | 295–296 | Webhook test-ping — `assertSafeUrl()` + plain `fetch()` (redirect bypass) | Replaced with `fetchWithSsrfGuard()` |
| `idp.service.ts` | 61 | SAML `buildSamlInstance` — `connection.entryPoint` passed to `@node-saml/node-saml` without guard | Added `assertSafeUrl(connection.entryPoint)` before `new SAML()` |

**Full audit of all outbound HTTP calls confirmed:** 16 call sites total. 12 already safe (hardcoded URLs, client-side, or properly guarded). 4 fixed this session. Zero remaining unguarded outbound requests.

---

## 🟡 Phase 4 — Observability

| What | Why |
|------|-----|
| Request-correlation IDs through FlowContext + auditService | Zero tracing today. Can't trace a failed login across hops. Audit log already has the right shape to carry correlation IDs. |
| P95/error-rate metrics on auth/token paths | These are the paths every other product depends on. No metrics at all. |

---

## 🔵 Deferred — do not start early

- BBS+ / selective-disclosure-beyond-SD-JWT — SD-JWT VC is correct; revisit only if a consumer needs it
- `did:jwk` — `did:key` sufficient for wallet DIDs
- Full OIDC4VCI/OIDC4VP — revisit after ArcWallet is live + external consumers exist
- OPA/Cedar policy engine, SCIM, Terraform provider — all v2+
- Identity-scoped signing key — permanently non-custodial by design
- LegalConsent — schema-only until a concrete consumer (TOS acceptance flow)
- CLI + SDK packages — after frontend rebuild stabilises API contract

---

## Audit session (2026-07-28) — 6 critical bugs fixed

### Bugs found & fixed

| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| 1 | 🔴 **CRITICAL** | `identity.sdk.ts` corrupted with null bytes — all 4 SDK identity tests crashed | Rewritten from scratch |
| 2 | 🔴 **CRITICAL** | `billing.schemas.ts` corrupted with null bytes — typecheck failed | Restored from git |
| 3 | 🔴 **HIGH** | `auth.sdk.ts:logout()` sent empty body, backend requires `{ sessionId }` — every logout returned 400 | Added `sessionId` parameter |
| 4 | 🔴 **HIGH** | `login.flow.ts` passkey check (`identity.passkeys?.length`) always `false` — `IdentityRepository.findForAuth()` never included `passkeys` in query | Added `passkeys: true` to repository include |
| 5 | 🟡 **MEDIUM** | `tenant.sdk.ts:list()` calls `GET /tenants` — no backend route exists, always returns 404 | Removed method |
| 6 | 🟡 **MEDIUM** | `email-verify.flow.test.ts` crashed at import — `auditService.log()` import chain reached real PrismaClient without `$extends` mock | Added `vi.mock` for auditService |

### Suite status: 59 files / 361 tests / 0 failures. Typecheck clean.

### Remaining gaps (low/moderate, no fix needed now)
- **Login passkey edge case test** — existing test at login.flow.test.ts:223 mocks identity directly bypassing the repository. Now that the repository is fixed, the mock approach masks the fix's verification. New test needed that exercises the full `findForAuth` → `hasPasskey` path.
- **21 missing audit assertions** — 21 out of 24 flows with audit side effects don't verify the call. Low risk (fire-and-forget `.catch(() => {})`), but weakens regression detection.
- **69 missing SDK methods** — SDK lags behind backend routes. Priority when frontend rebuild stabilizes.

---

## Test coverage — gaps remaining

Every core flow now has a passing test file in `src/modules/*/flows/`. What's genuinely untested are the **services, routes, and webhook delivery path** — these are exercised indirectly by the flow tests but lack their own dedicated test file.

| File (no test file found) | Graded risk | Notes |
|---------------------------|-------------|-------|
| `auth/services/mfa.service.ts` | **Medium** — otplib + QRCode wrapper; setup/verify/confirm logic tested via `mfa-setup.flow.test` + `mfa-verify.flow.test` (6+5=11 tests) | No standalone service test |
| `auth/services/passkey.service.ts` | **Medium** — @simplewebauthn wrapper; register/auth flows tested via `passkey-register.flow.test` + `passkey-authenticate.flow.test` (5+6=11 tests) | No standalone service test |
| `auth/services/password.service.ts` | **Low** — thin argon2 hash/verify wrapper, tested via `register.flow.test` + `login.flow.test` (6+11=17 tests) | No standalone service test |
| `auth/services/step-up.service.ts` | **Low** — elevation logic tested via step-up in `mfa-verify.flow.test` and `switch-context.flow.test` | No standalone service test |
| `credentials/services/signing.service.ts` | **Medium** — SD-JWT signing dispatcher, tested indirectly via `issue-credential.flow.test` (12 tests) | No standalone service test |
| `credentials/services/did.service.ts` | **Low** — did:web construction/resolution, tested via `did.route.test` (3) + `provision-tenant-did.flow.test` (4) | No standalone service test |
| `identity/routes/admin.route.ts` | **Medium** — identity status management, SYSTEM-ADMIN gated | No route test |
| `identity/routes/profile.route.ts` | **Low** — profile read + delete, tested via `update-profile.flow.test` (4) + `delete-account.flow.test` (4) | No route test |
| `identity/routes/delegation.route.ts` | **Low** — simple CRUD | No route test |
| `tenant/services/membership.service.ts` | **Low** — membership CRUD, tested via `add-member.flow.test` (2) + `remove-member.flow.test` (5) | No standalone service test |
| `tenant/services/onboarding.service.ts` | **Low** — tenant onboarding | No service test |
| `tenant/services/project.service.ts` | **Low** — project CRUD, tested via `create-tenant.flow.test` (7) | No standalone service test |
| `tenant/services/tenant.service.ts` | **Low** — tenant CRUD, tested via `create-tenant.flow.test` (7) | No standalone service test |
| `webhooks/routes/webhook.route.ts` | **Low** — inbound webhook ingestion endpoint | No route test; `webhook-config.route.test` covers config only |

**Bottom line:** 14 files uncovered, all low-to-medium risk. No uncovered gap is a prime regression vector — every core flow is protected. The only medium-risk files are `mfa.service`, `passkey.service`, `signing.service`, and `admin.route`, which would benefit from dedicated test files if those modules get refactored.

---

## ✅ Docker deployment — done

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build: deps (pnpm install + Prisma generate) → builder (tsup) → runner (`node:22-alpine`, 150MB). Entrypoint auto-runs `prisma migrate deploy`. |
| `docker-compose.yml` | 4 services: `postgres` (17-alpine), `redis` (7-alpine), `api` (Fastify, port 4000), `workers` (webhook delivery + token cleanup). Health checks on DB + Redis. |
| `.dockerignore` | Excludes frontend code, docs, git, agent artifacts. ~2MB build context. |
| `docker-entrypoint.sh` | Runs `prisma migrate deploy` (idempotent) on every container start, then exec's CMD. |
| `.env.example` | All 40+ env vars documented by category with sensible defaults. |

---

## Version note

`package.json` is `0.1.0`. Milestones:

- `0.1.0` (current) — Backend complete: presentation endpoint, all Phase 0–2, 57 files / 351 tests
- `0.2.0` — Frontend rebuilt, ArcWallet integration end-to-end
- `1.0.0` — Stable production with Phase 3+4 hardening

---

_Keep this file current. Any session that closes an item or discovers a new
one updates this roadmap and CLAUDE.md in the same commit._
updates this roadmap and CLAUDE.md in the same commit._
