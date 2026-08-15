# ArcID

> Sovereign, multi-tenant identity and access management engine for the ArcevoCirqle ecosystem.

ArcID is the identity backbone one person's verified attributes — a national ID, a professional license, an academic transcript — can be issued once, held by them, and reused across sectors, instead of every institution re-verifying the same facts from scratch. It's the foundation layer that ArcevoCirqle's per-sector products (starting with the academic space) build on.

## The problem this solves

Identity verification today is siloed per institution. A student re-proves who they are to their school, their bank, their employer, their government portal — each one running its own verification from zero, each one holding a copy of the same sensitive documents. ArcID exists so that verification happens once, by an authoritative issuer, and the resulting proof — a cryptographically signed Verifiable Credential — can be held by the individual and presented anywhere it's trusted, without re-exposing the underlying documents each time.

## What actually exists today

ArcID is a Fastify + PostgreSQL (Prisma) backend. Current state, verified against source:

- **Authentication** — email/password, WebAuthn passkeys, TOTP MFA, session management with per-tenant policy (session TTL, max concurrent sessions, required MFA).
- **OAuth2 / OIDC** — full authorization code + PKCE flow, JWKS, token introspection, refresh rotation with reuse detection.
- **Verifiable Credentials** — SD-JWT issuance and revocation, `did:web` and `did:key` resolution, tenant-owned signing keys (KMS-encrypted at rest).
- **Multi-tenancy** — tenant/project structure, membership with per-plan member caps, tenant-scoped policy enforcement.
- **RBAC** — fine-grained, database-backed permissions (18 seeded actions), replacing all hardcoded role checks.
- **External identifiers** — self-reported linking of secondary identifiers (phone, NIN, BVN, etc.) to an identity, hashed at rest.
- **Credential offers** — a tenant can create a pending offer for a subject, who accepts it (proving DID ownership) to receive the credential.
- **Presentation endpoint** — a holder can present a credential to a verifier via a two-step protocol: `/verify/session` creates a challenge, `/verify/present` accepts a JWS-signed proof + credential. Anti-replay enforced (single-use sessions, 5-min TTL). 6 JWS-proof + 14 route-level tests.
- **Webhooks, billing, audit logging** — webhook delivery with HMAC signing and retry, provider-driven (Stripe/Paystack) subscription billing, full audit trail.

## What's next

- **ArcWallet** — a companion React Native app (separate repo) where individuals hold their credentials and keys; ArcID never custodies wallet private keys.
- **ArcVerify** — the verifier-facing counterpart for institutions checking a presented credential.
- **Frontend rebuild** — `src/app/`, `src/components/`, `src/hooks/`, `src/store/` were replaced from scratch to ship an admin dashboard. The SDK layer is a thin wiring over the published `@arcevo/facet-sdk`, CSS tokens come from `@arcevo/facet-tokens`, and all UI primitives come from `@arcevo/facet-components` (facet migration Phases 1–3 done). The remaining migration phases (auth forms via `@arcevo/facet-auth`, layout, purge) are in progress.
- **Public SDK and CLI** — the frontend already consumes the published `@arcevo/facet-sdk`; a standalone `packages/cli` for external integrators comes once the API surface stabilises.

Live, granular status — what's done, what's in progress, what's explicitly deferred — is tracked in `docs/planning/arcid-v1-roadmap.md`, kept current as the actual source of truth for project state.

## Architecture, briefly

Business logic lives in **Flows** (`src/modules/<domain>/flows/`), never in route handlers — routes stay thin: auth guard → validate → run flow → reply. Each domain module (`auth`, `oauth`, `credentials`, `tenant`, `webhooks`, `billing`, `identity`, `idp`, `audit`) owns its own flows, routes, services, and validators. See `CLAUDE.md` for the full architectural contract this codebase follows.

## Status

Pre-release. Versioning follows `0.1.0` (current — backend complete: all Phase 0–4 shipped, frontend on facet packages: SDK/tokens/components/auth/layout migrated; 62 files / 340 tests) → `0.2.0` (frontend consumed from facet, ArcWallet integration end-to-end) → `1.0.0` (stable production with integration tests, secret scanning, migration rollback testing). Breaking changes should be expected at this stage.

## Getting started

See `CLAUDE.md` for the full engineering handbook (setup, conventions, testing) and `AGENTS.md` for the condensed always-loaded rules used by AI coding agents working in this repo.
