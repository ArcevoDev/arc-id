# ArcID

> Sovereign, multi-tenant identity and access management engine for the ArcevoCirqle ecosystem.

ArcID is the identity backbone... one person's verified attributes (a national ID, a professional license, an academic transcript) can be issued once, held by them, and reused across sectors, instead of every institution re-verifying the same facts from scratch. It's the foundation layer that ArcevoCirqle's per-sector products (starting with the academic space) build on.

## The problem this solves

Identity verification today is siloed per institution. A student re-proves who they are to their school, their bank, their employer, their government portal — each one running its own verification from zero, each one holding a copy of the same sensitive documents. ArcID exists so that verification happens once, by an authoritative issuer, and the resulting proof — a cryptographically signed Verifiable Credential — can be held by the individual and presented anywhere it's trusted, without re-exposing the underlying documents each time.

## What exists today (v0.1.0)

ArcID is a **Fastify + PostgreSQL (Prisma)** backend with a **Next.js 16** admin dashboard. All state below is verified against source and CI.

**Authentication** — email/password (bcrypt), WebAuthn passkey registration & authentication, TOTP MFA, magic links. Per-tenant policy enforcement (session TTL, max concurrent sessions, required MFA, allowed email domains, password rules).

**OAuth2 / OIDC** — full authorization code + PKCE flow, JWKS, token introspection, refresh-token rotation with reuse detection. OIDC discovery + userinfo endpoints. Social login (Google, GitHub, Apple, Microsoft) via `arctic`.

**Verifiable Credentials** — SD-JWT issuance (with `requireLegalConsent` and `ExternalIdentifier.verified` gates) and revocation, `did:web` and `did_key` resolution, tenant-owned signing keys (KMS-encrypted at rest). Presentation protocol: `/verify/session` creates a challenge, `/verify/present` accepts a JWS-signed proof — anti-replay enforced (single-use sessions, 5-min TTL).

**Multi-tenancy & RBAC** — tenant/project structure, membership with plan-based member caps, database-backed permissions (18 seeded actions), fine-grained access control.

**External identifiers** — linking of secondary identifiers (phone, NIN, BVN, etc.) to an identity, hashed at rest, with confirmation flows.

**Webhook delivery** — HMAC-signed delivery with retry logic and failure tracking.

**Subscription billing** — provider-driven (Stripe/Paystack/Flutterwave) billing with centralized plan caps shared between frontend and backend.

**Audit logging** — structured audit trail with correlation IDs.

**DevOps** — multi-stage `Dockerfile` (node:22-alpine), `docker-compose.yml` (Postgres 17 + Redis 7 + API + workers), auto-migrate entrypoint. See `Dockerfile` and `.env.example`.

**Observability** — Pino structured logs with traceId on every flow, `GET /metrics` endpoint via `@fastify-metrics`, correlation IDs through `FlowContext.requestId`.

**Security hardening** — SSRF protection (`assertSafeUrl` on all user-supplied URLs), CSRF state on OAuth cookies (`sameSite: lax`, `httpOnly`, `secure`), cross-tenant HTTP isolation tested, distributed token revocation (Redis blocklist + sessionId binding).

**Frontend** — full admin dashboard built on published `@arcevo/facet-*` packages: `@arcevo/facet-sdk` (class-based client + singleton wiring), `@arcevo/facet-components` (all UI primitives), `@arcevo/facet-layout` (`AuthLayout` + `ConsoleLayout`), `@arcevo/facet-auth` (auth forms), `@arcevo/facet-tokens` (CSS tokens), `@arcevo/facet-store` (Zustand state). No local UI primitives to maintain.

### Verification

- **61 test files / 342 tests / 0 failures** (`pnpm test`)
- **Typecheck clean** (`tsc --noEmit`)
- **Migration chain integrity** verified (no-drift rollback tests)
- CI pipeline: install → prisma generate → schema validate → typecheck → lint → secret scan → trivy → test → rollback guard → build

## What's next (v2 roadmap)

See `docs/planning/arcid-v2-roadmap.md` for the current planning document. In short:

- **API keys** — backend CRUD routes + Prisma model (frontend UI stub removed; tracked for v2).
- **CLI & SDK packages** — standalone `packages/cli` for external integrators.
- **ArcWallet integration** — end-to-end wallet connection for credential possession.
- **Production hardening** — full integration test suite against live Postgres, open-source release.

## Architecture, briefly

Business logic lives in **Flows** (`src/modules/<n>/flows/`), never in route handlers — routes stay thin: auth guard → validate → `FlowExecutor.execute()` → reply. Each domain module (`auth`, `oauth`, `credentials`, `tenant`, `webhooks`, `billing`, `identity`, `idp`, `audit`) owns its own flows, routes, services, repositories, validators, and presenters. See `CLAUDE.md` for the full architectural contract.

## Getting started

See `CLAUDE.md` for the full engineering handbook (setup, conventions, testing) and `AGENTS.md` for the condensed always-loaded rules used by AI coding agents working in this repo.
