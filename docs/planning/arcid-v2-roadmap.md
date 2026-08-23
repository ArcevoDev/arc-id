# ArcID v2 Roadmap

> **Status**: Active development. v1 (0.1.0 backend) is **COMPLETE**.
> Last updated: 2026-08-22.
> Companion to CLAUDE.md (canonical handbook, single source of truth for
> status tables and rationale).

---

## 🟢 v1 — COMPLETE (0.1.0)

Backend complete. All Phase 0–8 + Phase E shipped. 61 test files / 342 tests / 0 code failures. Typecheck clean on `tsc --noEmit`.

| Area | Status | Notes |
|------|--------|-------|
| Auth | ✅ | Password, passkey, magic-link, TOTP MFA, social login (Google/GitHub/Apple/Microsoft) |
| OAuth2/OIDC provider | ✅ | Auth code + PKCE, refresh rotation, introspection, revocation, JWKS, discovery, userinfo |
| Verifiable Credentials (SD-JWT) | ✅ | Issue (E1, E2 gates), verify, presentation/exchange |
| did:web + did:key | ✅ | Per-tenant DID resolution, KMS-encrypted signing keys |
| Multi-tenant RBAC | ✅ | 19 seeded permissions, 16 permission-gated routes |
| SAML2 + OIDC federation | ✅ | `idp` module — outbound SP-initiated federation |
| Webhooks | ✅ | HMAC-signed delivery, retry, test-ping |
| Sessions + revocation | ✅ | Redis-backed distributed revocation (`blockJti` + `revokedJti`) |
| Tenant policy | ✅ | 6 enforced fields (requireMfa, maxSessionsPerUser, sessionTtlMinutes, allowedEmailDomains, allowPasskeys, requireLegalConsent) |
| Audit logging | ✅ | 51 AuditLogAction enum values, 100% call-site coverage |
| Rate limiting | ✅ | Per-route, per-IP, on all auth-sensitive endpoints |
| CORS | ✅ | Restricted to `allowedOrigins` env |
| Secrets/PII in logs | ✅ | CI secret + PII scan enforced |
| SSRF | ✅ | All outbound fetches pass `assertSafeUrl()` |
| CSRF | ✅ | OAuth state cookies only; `sameSite: lax + httpOnly + secure` |
| Cross-tenant | ✅ | 6 isolation tests (3 HTTP + 3 unit) |
| Security hardening | ✅ | Phase 3 closed (2026-07-28) |
| Observability | ✅ | Phase 4 shipped (2026-07-28): Pino structured logs, correlation IDs, `/metrics` |
| Docker | ✅ | Multi-stage Dockerfile (node:22-alpine) + `docker-compose.yml` |
| LegalConsent gate | ✅ | Wired in `issue-credential.flow.ts` (E2) |
| ExternalIdentifier gate | ✅ | Wired in `issue-credential.flow.ts` (E1) |
| Frontend rebuild | ✅ | Facet migration Phases 0–6 + E complete (2026-08-19) |
| SDK | ✅ | Published `@arcevo/facet-sdk@1.1.0`, class-based `AuthSdk`/`TenantSdk`/etc. |
| CLI | ✅ | Package scaffolded (`packages/cli`) on `@arcevo/facet-cli@0.8.0` |

**v1 is closed.** All items in `arcid-v1-roadmap.md` are resolved. That file
has been removed; this document supersedes it.

---

## 🔄 v2 — ACTIVE (0.2.0)

Frontend consumed from facet packages + ArcWallet integration. Backend API
contract stabilized for the CLI package.

### 0.2.0 — "ArcWallet integration + backend polish"

| # | Item | Priority | Status |
|---|------|----------|--------|
| 1 | ArcWallet companion app — end-to-end wallet issuance/verify/presentation flow (separate package) | P0 | ⏳ Not started |
| 2 | API key management backend — CRUD flows + routes (OAuth2 bearer-token style keys) | P1 | ⏳ Frontend was a stub (stub removed Aug 2026); backend not started |
| 3 | CLI package extraction — move `packages/cli` to published `@arcevo/arcid-cli` npm package | P1 | ⏸️ Scaffolded; pending API contract stability |
| 4 | Integration tests against real Postgres (`pnpm test:rollback`) | P2 | ⏸️ Opt-in; needs Postgres 17 service |
| 5 | SDK `TenantSdk.create()` test coverage gap (P4.3) | P2 | ⏸️ Not blocking; 6-test `sdk.test.ts` passes |
| 6 | Console dashboard — final cleanup (remaining SDK-direct imports in pages) | P3 | ⏸️ Pragmatically acceptable |
| 7 | Billing UI — pricing from `src/config/plan-caps.ts` displayed via `BillingPage` (facet-components) | P2 | ✅ In progress (working tree) |

### 0.2.1 — "Edge cleanup"

| # | Item | Priority |
|---|------|----------|
| 1 | Remove dead `DELEGATION_GRANTED` / `DELEGATION_REVOKED` audit enum values | — ✅ DONE (2026-08-22, migration `20260822000000`) |
| 2 | Remove remaining stale `create-tenant` hardcoded caps (replaced by `plan-caps.ts`) | — ✅ DONE |

> **Note**: The `plan-caps.ts` config (`src/config/plan-caps.ts`) is the single
> source of truth for plan limits (tenants, members, audit days), shared between
> `create-tenant.flow.ts`, `membership.service.ts`, and the billing UI.

---

## 🔵 v2+ — Future milestones

### 1.0.0 — "Stable production release"

| # | Item | Priority |
|---|------|----------|
| 1 | Full integration test suite against live Postgres 17 | P0 |
| 2 | ArcVerify — verifier-facing counterpart (presentation verification endpoint) | P0 |
| 3 | Open-source release (repo public, license, contribution guide) | P0 |
| 4 | Credential revocation via status lists (RFC 9397) | P1 |
| 5 | Production monitoring: alerting on rate-limit breaches, audit-log volume drops | P1 |

### Deferred (exploratory)

| Item | Category |
|------|----------|
| BBS+ anonymous credentials | Cryptographics |
| did:jwk DID method | DID |
| OIDC4VCI credential issuance | Protocols |
| OPA / Cedar policy engine | Authorization |
| SAML 2.0 IdP-initiated flow | Federation |
| SCIM provisioning | Provisioning |
| Passkey attestation | WebAuthn |
| WebAuthn conditional mediation | UX |
| Credential manifest | Protocols |
| ZKP for SD-JWT | Cryptographics |
| DIDComm messaging | Protocols |
| FIDO2 enterprise attestation | Enterprise |
| Credential status (bitstring / revocation list) | Revocation |

---

## CLI + SDK packages

- **SDK** — published `@arcevo/facet-sdk@1.1.0` (class-based `AuthSdk`,
  `TenantSdk`, `OAuthSdk`, `CredentialSdk`, `WebhookSdk`). `src/sdk/index.ts`
  is a thin singleton that owns the `ArcIdClient` + 401 auto-refresh (wired to
  the Zestand auth store) and re-exports the facet domain SDKs.
- **CLI** — `packages/cli` scaffolded on `@arcevo/facet-cli@0.8.0`. Pending API
  contract stability before extracting to its own npm package.

---

## File: arcid-v2-roadmap.md

_Keep this file current. Any session that closes an item or discovers a new one
updates CLAUDE.md and docs/planning/arcid-v2-roadmap.md in the same commit._
