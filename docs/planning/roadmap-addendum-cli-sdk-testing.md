# Addendum — sequencing update (2026-07-03)

> Splice this in near the top of `docs/planning/arcid-v1-roadmap.md`, right
> after the "Corrections to the prior review" section and before "Phase 0."
> Direction from Arcitect: before any component package (SDK, CLI) is
> deployed publicly, the backend needs to be fully hardened, and both the
> CLI and the frontend need real test coverage to build against — not just
> Swagger/Postman manual checks. This reorders the existing Phase 0–4 plan
> around that constraint without discarding any of it.

## New finding this pass — the tests are "phantom-ready"

`vitest`, `@vitest/coverage-v8`, and `vitest.config.ts` are all already in
`package.json`/root, and `pnpm test` / `pnpm test:watch` / `pnpm test:coverage`
scripts already exist. **Zero `*.test.ts` files exist anywhere in the repo.**
This is the kind of gap that survives a casual audit — "we have Vitest set
up" reads as true from `package.json` alone — but there is currently no
executable regression coverage at all. `docs/planning/testing-guide.MD` is a
complete *manual* Postman/Swagger matrix (65 numbered checks across 13
blocks) but nothing in it has been converted to code. Treat "add vitest" as
already done; treat "write the tests" as the actual open item.

## Phase 0.5 — Test & tooling foundation (insert before Phase 1, ~1–1.5 weeks)

This is what has to exist before CLI/SDK work starts, because both will be
built and reviewed against these tests rather than against manual Postman
runs.

1. **Convert `testing-guide.MD`'s 65-case matrix into real Vitest specs.**
   Not 1:1 — group by the same blocks (health, register/verify, login/session,
   OAuth token lifecycle, MFA, step-up, passkeys, tenant/membership,
   credentials, webhooks, admin, audit) and use Fastify's `inject()` for
   route-level integration tests, in the order already set in `CLAUDE.md`'s
   testing strategy: `login.flow.ts` → `session.service.ts` →
   `token.service.ts` → `jti-blocklist.ts` → `triggerKillChain`.
2. **Keep `testing-guide.MD` alive as the manual fallback**, but retitle its
   role — once Block 1–6 have Vitest coverage, mark them
   "automated, see `src/modules/auth/**/*.test.ts`" in the doc rather than
   deleting the manual steps; SAML/social-login blocks that need a real IdP
   stay manual for now.
3. **Fix Phase 0's five bugs *with* a regression test each**, not just a
   patch — the verification-algorithm mismatch, the status-list race, and
   the federated-login account-takeover gap are exactly the kind of bug
   that comes back silently without a test pinning the fix.
4. Target: core auth + token + credential flows at meaningful coverage
   before Phase 1 starts, not ≥70% repo-wide (that's still the `0.3.0`
   milestone per `CLAUDE.md`'s versioning table).

## Reordering: CLI and SDK move up, ahead of "defer to v2"

The existing roadmap's "What to explicitly defer past v1" section lists
"OPA/Cedar policy engine, SCIM, Terraform provider, CLI — all real v2+
platform features, none block ArcWallet/ArcVerify shipping." That's correct
for *ArcWallet/ArcVerify shipping* specifically, but it's not correct for
"component packages" more broadly, which is the actual dependency Arcitect
flagged. Split it:

- **Still v2, correctly deferred:** OPA/Cedar, SCIM, Terraform provider.
- **Pulled forward, ahead of any package deployment:**
  - **`packages/cli/` scaffold** — per the plan already written in
    `CLAUDE.md`'s "CLI (planned)" section (commander or `@clack/prompts`,
    device-code or PKCE auth against `ARCID_API_URL`, JSON output by
    default). Build it against the now-tested Phase 0.5 endpoints first:
    `login`, `tenants list`, `tokens revoke`, `webhooks events` — these are
    all stable, already-tested surfaces, so the CLI isn't the thing
    discovering backend bugs.
  - **`packages/sdk/` extraction** — `src/sdk/` today is Next.js/Zustand-
    coupled frontend code, not a publishable package. Per `CLAUDE.md`, this
    was already scoped as a `0.2.0+` milestone (once the API surface is
    stable) — keep that gate, but do the extraction (framework-agnostic,
    ESM+CJS dual build, typed exports) right after Phase 1 (OAuth/aal gap)
    closes, since that's the last surface change the SDK's shape depends on.
  - Both packages get added to `pnpm-workspace.yaml` (`packages: - packages/*`)
    when their scaffolding starts, not before.

## Where this sits relative to the existing phases

```
Phase 0   — bug fixes (unchanged, still first)
Phase 0.5 — NEW: convert testing-guide.MD → Vitest, pin Phase 0 fixes with tests
Phase 1   — OAuth/aal gap for first-party apps (unchanged)
  → packages/sdk/ extraction starts once Phase 1 closes
  → packages/cli/ scaffold starts once Phase 0.5 closes (can run in parallel with Phase 1)
Phase 2   — ArcWallet-facing API surface (unchanged)
Phase 3   — Security hardening (unchanged)
Phase 4   — Observability (unchanged)
Package deployment (SDK to npm, CLI to npm) — only after Phase 2 + Phase 0.5
  both closed, since Phase 2 is what ArcWallet/ArcVerify actually consume
```

## Version note

`package.json` already reads `0.0.1` — the rename from `0.1.0` mentioned in
`CLAUDE.md` is done, not still pending. No action needed there.
