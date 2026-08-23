# arc-id: Episodic Canon
## (what broke, how we fixed it, what survived) – local tracker

> Purpose: a living narrative of how this repo reached a working, automated state.
> Written in `.agent/` (gitignored, local-only) so the tracker reflects process
> without polluting the published tree.
> Canonical facts live in CLAUDE.md; this file lives in the head between sessions.
>
> Mantra: evolution is the only option.
> Rule chain: manual → semi-automated → automated. If a fix is still manual
> after a release, it is not done.

================================================================================

EP 01 -- The Audit Sweep
--------------------------------------------------------------------------------
What broke:
  A repo-wide audit uncovered drift across documentation, frontend/backend sync,
  and dead code:

  (a) README.md was stale: claimed 62 files / 340 tests (actual: 61 / 342),
      said the facet migration was "in progress" (it was fully done Phases 0–6
      + E), and omitted Docker, observability, and security hardening status.

  (b) CLAUDE.md / AGENTS.md had incorrect counts: 16 permissions (actual: 19
      seeded in prisma/seed.ts), 5 enforced TenantPolicy fields (actual: 6 after
      requireLegalConsent was wired in 0.1.0), 53 audit enum values (now 51 after
      removing dead DELEGATION_* values), and inaccurately claimed
      `src/components/ui/` was deleted — it retains 3 app-specific wrappers
      (icon.tsx, typewriter-text.tsx, icons.generated.tsx) for tree-shaken
      icon imports and a landing-page animation.

  (c) Frontend/backend sync gap: an API Keys page existed in the nav + a hook
      (`use-api-keys.ts`) returned stub data (501 on create/revoke), but the
      backend had zero API key implementation — no Prisma model, no routes,
      no flows. A complete UI for a feature that does not exist.

  (d) Orphaned page: the nav removed the "Organization" section, but
      `organization/members/page.tsx` (a real implementation backed by
      TenantSdk.listMembers) was unreachable from navigation.

  (e) Dead enum values: `DELEGATION_GRANTED` / `DELEGATION_REVOKED` existed in
      the `AuditLogAction` enum but were never produced by any code path —
      `delegation.route.ts` emits no audit events (exhaustive grep 2026-08-20).
      Originally added in migration `20260606133243_audit_update`.

  (f) Stale tracking artifacts: `arcid_codebase_snapshot.txt` (3.1 MB) was
      tracked in git despite being in .gitignore; temp files (.tmp-tc-out.txt,
      .tmp-test-output.txt, .agent/output.txt) cluttered the working tree.

  (g) Local environment: `next` was bumped 16.3.1 → 16.3.2 in package.json but
      `pnpm install` was never run, breaking typecheck ("Cannot find module
      'next'"). Restored to the committed 16.3.1.

  (h) Stale doc cross-references: `docs/planning/arcid-cli-design.md` and
      `src/lib/security/password-rules.ts` both referenced the v1 roadmap,
      which is being closed.

How we fixed it:
  - Deleted `arcid_codebase_snapshot.txt` (untracked snapshot, 3.1 MB, gitignored).
  - Deleted temp files: .tmp-tc-out.txt, .tmp-test-output.txt, .agent/output.txt.
  - Moved `.agent/oauth-secrets-setup.md` → `docs/planning/oauth-secrets-setup.md`
    (was hidden in gitignored tooling dir, is useful developer reference).
  - Rewrote README.md: 61 files / 342 tests (was 62 / 340), facet migration
    marked complete, Docker + observability + security hardening statuses
    populated.
  - Fixed `docs/migration/facet-migration-guide.md`: internal contradiction
    (said Phase 6 purge "still holds forms" while also saying "FULLY done") —
    body text aligned with completed status.
  - Then DELETED `docs/migration/facet-migration-guide.md` entirely — the
    migration is complete; its status lives in CLAUDE.md P0 row; the guide was
    stale process documentation with no ongoing use.
  - Updated CLAUDE.md: 16→19 permissions, 5→6 enforced TenantPolicy fields,
    53→51 audit enum values, corrected "ui/ deleted" claims to "shadcn/ui
    purged, 3 app-specific wrappers retained", marked P4.1 (dead enums) Done,
    P4.3 (SDK test coverage) carried to v2, fixed corrupted garbled footer,
    updated versioning section (v1 complete, v2 active).
  - Updated AGENTS.md: removed stale "API keys hooks use facet SDKs" claim
    (was a stub, now deleted), corrected "ui/ deleted" claims.
  - Deleted `docs/planning/arcid-v1-roadmap.md` — v1 (0.1.0 backend) complete,
    superseded by v2 roadmap (`docs/planning/arcid-v2-roadmap.md`).
  - Removed API Keys frontend stub: deleted `src/hooks/use-api-keys.ts`,
    `src/app/console/api-keys/page.tsx`, removed nav link from `src/config/nav.ts`.
  - Fixed orphaned Organization pages: added "Members" to Identity nav section
    (`/console/organization/members` — the page is a real implementation, just
    was unreachable from the menu).
  - Removed `DELEGATION_GRANTED` / `DELEGATION_REVOKED` from `AuditLogAction`
    enum in `prisma/schema.prisma` + PostgreSQL migration
    `20260822000000_remove_dead_audit_enum_values` (recreates the enum type
    without the dead values, casts AuditLog.actionId + WebhookEvent.eventType).
  - Updated downstream references: `docs/planning/arcid-cli-design.md` and
    `src/lib/security/password-rules.ts` now point to v2 roadmap.

State: semi-automated.
  - Code fixes (API keys removal, nav fix, enum removal) are permanent — the
    code itself enforces these contracts going forward.
  - Doc drift is NOT yet guarded by CI. A future drift gate could assert key
    counts (permissions, enum values, test counts) against their canonical
    source instead of prose.
  - The `next` install issue was environmental (uncommitted package.json diff).
    CI's `pnpm install --frozen-lockfile` is immune.

Lesson: a repo accumulates "claims" in prose (counts, statuses, roadmap
references) that silently diverge from the code. The fastest drift is a frontend
page for a feature that doesn't exist in the backend — it compiles, it tests,
it passes CI, and it's still wrong. Regular sweeps catch the claims prose
can't make on its own.

================================================================================

EP 02 -- The Security Five
--------------------------------------------------------------------------------
The question:
  What security properties did we promise in prose that the code never enforced?

What broke:
  Five Phase-0 gaps — each an invariant that lived in intent, not in code:
  (a) verify-credential hardcoded ES256 in importSPKI() — the algorithm was read
      from the JWT header in signJwt, but verify did not. Key rotation to a new
      alg would silently use the wrong key.
  (b) signing.service threw an opaque 500 ("No active signing key found") when
      an identity-owned DID was used for issuance — no clear 4xx, no v2 deferral.
  (c) status-list allocateIndex used a read-then-write on issuedCount — two
      concurrent issuance requests could assign the same index, corrupting the
      status list.
  (d) federated auto-link (social.route.ts + idp.service.ts) linked a federated
      identity to a local account by email — no emailVerified check.
  (e) seed script fell back to a hardcoded dev password in production when
      ADMIN_PASSWORD was unset.

Evidence (git history):
  74a8d70 (alg from header) . 1bf7f19 (identity DID -> 4xx) . 1857d3a (CAS index)
  afbec44 (emailVerified gate) . e2982ec (prod ADMIN_PASSWORD). All closed
  Phase-0 items from the (now-deleted) v1 roadmap.

How we fixed it:
  Each gap -> direct code fix: dynamic alg, clear 4xx (deferred to v2),
  compare-and-swap + retry, emailVerified === true gate, production-only
  ADMIN_PASSWORD. The invariant is now in the code path, not the prose.

State: automated. Open question: are there Phase-0 gaps we haven't named?
Every un-enforced invariant is a latent vulnerability.

Lesson: a security property not asserted in code is a promise waiting to break.

===============================================================================

EP 03 -- The Phantom Feature
--------------------------------------------------------------------------------
The question:
  How did a complete UI page ship for a backend feature that doesn't exist?

What broke:
  An API Keys page lived in the nav + a use-api-keys.ts hook returned stub data
  (501 on create/revoke) — but the backend had zero API key implementation: no
  Prisma model, no routes, no flows. A beautiful page for a feature that does
  not exist. It compiled, tests passed, CI was green — and it was still wrong.

Evidence (git history):
  5551552 deleted src/hooks/use-api-keys.ts, src/app/console/api-keys/page.tsx,
  and the nav link. The gap was invisible to every check except the manual audit.

How we fixed it:
  Deleted the frontend stub entirely. API keys will be rebuilt properly as a v2
  feature (tracked in arcid-v2-roadmap.md).

State: automated. The code itself now enforces the contract — no frontend sheet
without a backend counterpart.

Lesson: a frontend for a non-existent backend is the fastest drift — it compiles,
tests, and passes CI while being entirely wrong.

===============================================================================

EP 04 -- The Merge Storm
--------------------------------------------------------------------------------
The question:
  Why do WIP branches + stabilization merges multiply churn instead of
  containing it?

What broke:
  The repo cycled: WIP local state (0564987) -> stabilization/pre-ui-hardening
  branch (d13c154, 79ac523, 226b0ff) -> MVP (142501f) -> three merge PRs
  (#1, #2, #3). Each stabilization branch was a parallel reality that diverged
  from main and had to be rebased back in. The merge commits multiplied, and the
  same files were touched twice — once in the branch, once resolving the merge.

Evidence (git history):
  0564987 (WIP before sync) . 79ac523 / 226b0ff (WIP on stabilization branch)
  3e81a63, c8ce34b, 2aed13b (three merge PRs) . 142501f ("server 0.1.0 done --
  phase 2 ongoing": the WIP never cleanly landed).

How we fixed it:
  Converged on a single branch (main). Stabilization WIP was absorbed; subsequent
  work went to main with direct commits + short-lived feature branches.

State: semi-automated. The process is now "trunk-first, feature branches short,
merges fast-forward where possible." But WIP branches still create parallel
realities that cost double.

Lesson: a WIP branch is a parallel universe — one cost to write, one to merge.
Trunk-first with small, frequent commits is the only way to keep the story honest.

===============================================================================

EP 05 -- The Environment Fragility
--------------------------------------------------------------------------------
The question:
  What claims did the local tree make that CI's frozen lockfile couldn't catch?

What broke:
  (a) next was bumped 16.3.1 -> 16.3.2 in package.json but pnpm install was
      never run — typecheck broke locally ("Cannot find module 'next'"). CI's
      --frozen-lockfile was immune, but a dev's local break was invisible to CI.
  (b) An IDE crash corrupted .commandcode/settings.json with null bytes (54567e2).
      Binary corruption in a JSON file, silent until something read it.
  (c) Temp files cluttered the working tree: .tmp-tc-out.txt, .tmp-test-output.txt,
      .agent/output.txt — and arcid_codebase_snapshot.txt (3.1 MB) was tracked in
      git despite being gitignored.

Evidence (git history):
  54567e2 (null-byte fix) . 5551552 (audit sweep deleted temp files + 3.1 MB
  snapshot, restored next to 16.3.1). The working tree later re-bumped next to
  16.3.2 with a matching lockfile (a real upgrade now, not a drift).

How we fixed it:
  Deleted temp files + snapshot; restored next to the committed 16.3.1; added
  null-byte check on settings.json. The lockfile is the source of truth — a
  package.json bump without an install is invisible to CI.

State: semi-automated. CI's --frozen-lockfile catches lockfile/package.json drift;
the null-byte and temp-file sweeps are manual. A pre-commit hook checking for
stale artifacts would close the loop.

Lesson: the local tree is a claim. A package.json bump without install is a lie CI
won't catch; a file that crashes the editor mid-save is a latent corruptor.
Environment claims need gates, not hope.

===============================================================================

EP 06 -- The CI Trust Gap
--------------------------------------------------------------------------------
The question:
  Where did our automation report success without proof?

What broke:
  CI ran pnpm test (342 passing) + typecheck (clean) — both green throughout the
  audit sweep. Yet the tree contained:
  (a) Two DELEGATION_* enum values in AuditLogAction that no code path ever
      produced (dead code, removed via migration 20260822000000).
  (b) AGENTS.md claimed "src/components/ui/ was deleted" — it retains 3
      app-specific wrappers (icon.tsx, typewriter-text.tsx, icons.generated.tsx).
  (c) Counts drifted: README said 62 files / 340 tests (actual 61 / 342); claimed
      16 permissions (actual 19), 5 TenantPolicy fields (actual 6), 53 audit enum
      values (actual 51).

Evidence (git history):
  5551552 (audit sweep). CI was green at every step — the gaps were only visible
  to a manual repo-wide audit tracing each claim to its canonical source.

How we fixed it:
  The audit sweep corrected all counts, deleted dead code, fixed prose. But the
  root cause — CI verifies compilation and tests, NOT that prose matches reality —
  remains.

State: semi-automated. No drift gate on prose counts exists. A future CI step
could assert key counts against their canonical source (permissions in seed.ts,
enum values in schema.prisma, test files via glob) instead of trusting prose.

Lesson: automation that reports success without proof is the CI trust gap. Green CI
is evidence the code compiles, not that the claims are true. A gate that only
runs tests signs off on a lie.

===============================================================================

EP 07 -- The Tracker Drift
--------------------------------------------------------------------------------
The question:
  When does the story we tell outrun what's actually true?

What broke:
  The .agent tracker + CLAUDE.md + AGENTS.md are the canonical story of the repo's
  state — but they're prose claims (numbers, statuses, roadmap refs) that drift
  from the code the moment reality changes. The audit sweep corrected:
  permissions 16 -> 19, TenantPolicy fields 5 -> 6, audit enum 53 -> 51. Without
  the sweep, the story still says 16 / 5 / 53.

  This mirrors facet's Episode 07: a local changeset version was tracked as
  "published" when it lived only on disk — the tracker outran the git tags.

Evidence (git history):
  5551552 re-synced all counts to reality. The .agent/episodes.md header warns:
  "Canonical facts live in CLAUDE.md; this file lives in the head between sessions"
  — the tracker is between-sessions, always at risk of drift.

How we fixed it:
  The audit sweep re-synced tracker to reality. But the tracker is still prose —
  vulnerable to the same drift as soon as code changes again.

State: semi-automated. The sweep is manual. A drift gate (assert counts in CI
against their source) would automate it — but no such gate exists yet.

Lesson: the tracker is a claim, not a fact. Sync it to git tags after every
release, not to local bumps. Prose counts are bugs waiting to happen.

===============================================================================

EP 08 -- The Facet Migration
--------------------------------------------------------------------------------
The question:
  Why migrate primitives before composites?

What broke:
  The frontend was a tangle: some pages used the facet SDK, some used in-repo
  hooks; some used facet components, some used deleted shadcn wrappers; auth forms
  still existed in-repo while facet-auth was available. No reader could follow the
  dependency graph. The in-repo factory-pattern SDK (src/sdk/*.sdk.ts) coexisted
  with the published @arcevo/facet-sdk@1.1.0.

Evidence (git history):
  Phase 1: 049f7cd (migrate frontend to facet SDK, components, hooks) — SDK first.
  Phase 3: c1bfba2 (facet-components native Icon API) — primitives second.
  Phase 5: 646fed1 (migrate layouts to facet-layout) — composites third.
  Phase 4/6: d6f6707 (auth -> facet-auth) . e402622 (forgot/reset -> facet-auth) —
  auth flows last. 7bfad24 / aba18f8 (Phase 6 purge complete): in-repo SDK deleted,
  src/sdk/index.ts becomes a thin singleton wiring facet SDKs.

How we fixed it:
  A phased migration — SDK first, then UI primitives (components, tokens), then
  layouts, then auth flows. Each phase migrated the shared primitive, updated all
  consumers, and deleted the old code in one cut — never consumer-by-consumer.

State: automated. Migration complete; facet packages pinned (sdk 1.1.0, auth 1.2.2,
components 1.10.0, layout 1.4.1, tokens 1.1.4). The dependency graph is linear now.

Lesson: a migration that replaces consumers one-by-one creates a tangle. Migrate
the shared primitive first, then flip every consumer at once — one cut, clean.

===============================================================================

EP 09 -- The Hardening Loop
--------------------------------------------------------------------------------
The question:
  How do we prove the system works as a whole, not just in pieces?

What broke:
  Phase 0 shipped server 0.1.0 as individually-correct flows — but the system had
  never been exercised end-to-end against a real (or simulated) tenant with real
  cross-tenant boundaries. The hardening phase (Phase 3) asked the hard questions:
  (a) Can a tenant's request touch another tenant's data?
  (b) Can an outbound fetch to a user-supplied URL be weaponized (SSRF)?
  (c) Can a revoked token still be used after revocation?
  (d) Are we flying blind on failures?

Evidence (git history):
  c2e758a (session revocation + CI rollback guard) . 5551552 (audit sweep).
  AGENTS.md: "Security hardening — Closed (2026-07-28)": 3 cross-tenant HTTP tests
  (fastify.inject, pass), 4/4 SSRF gaps closed (idp OIDC discovery + token
  endpoint, webhook test-ping, SAML entryPoint), CSRF review (state cookies
  sameSite:lax + httpOnly + secure), Redis-backed distributed revocation
  (AccessToken.sessionId + DELETE /sessions/:id -> blockJti + revokedJti.create),
  observability (traceId via FlowContext.requestId, @fastify-metrics at /metrics).

How we fixed it:
  Turned every invariant into an assertion: cross-tenant data -> integration test;
  outbound fetch -> assertSafeUrl() gate; token revocation -> blockJti + revokedJti
  together; observability -> correlation IDs + metrics endpoint.

State: automated. The gates are in CI (integration tests, typecheck). The open
question: can a tenant touch another's data through a path the test doesn't cover?

Lesson: individual correctness is not system correctness. The hard questions are
cross-cutting — can tenants see each other? Can a URL be weaponized? Can a token
outlive its revocation? Answer each with a test, not a hope.

===============================================================================
END
