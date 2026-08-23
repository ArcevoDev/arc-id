# arc-id: The Story So Far (Plain English)
## A living, non-technical history of how this repo learned to stop breaking

> Same story as `.agent/episodes.md`, but told so a PM, designer, manager, or
> newcomer can follow it without reading code.
>
> Mantra: Evolution is the only option.
> Rule: manual → semi-automated → automated. If a fix is still manual after a
> release, it's not done.

--------------------------------------------------------------------------------

## Chapter 1 — The Great Cleanup
--------------------------------------------------------------------------------
We did a full-repo audit sweep — reading every doc, checking every count,
tracing every frontend-to-backend link — to find where "what we said" had
drifted from "what is true."

What was wrong:
- The README said 62 files / 340 tests. Reality: 61 files / 342 tests.
- Docs said the facet migration was "in progress." It was fully done.
- The API Keys page existed in the navigation, but the backend never
  implemented API keys. The page showed an empty list; clicking "create"
  returned "not implemented." A beautiful page for a feature that doesn't
  exist.
- The "Organization" section was removed from the nav, but the Members page
  (which actually works) was left stranded — reachable by direct URL but
  invisible from the menu.
- The audit log had two enum values ("DELEGATION_GRANTED",
  "DELEGATION_REVOKED") that no code anywhere ever produced. Dead weight.
- A 3.1 MB snapshot file was tracked in git despite being in .gitignore.
- Stale temp files cluttered the working tree.
- The local dev environment had a broken Next.js install (version bumped but
  never installed).
- Some docs referenced the old v1 roadmap that was being closed.

How we fixed it:
- Deleted the snapshot file and all temp files.
- Rewrote the README to match reality (correct counts, correct statuses).
- Deleted the facet migration guide — the migration is done; its status lives
  in CLAUDE.md now.
- Deleted the v1 roadmap — v1 is complete; created a v2 roadmap for what's next.
- Removed the API Keys page, hook, and nav link — there's no backend to back
  them. We'll build API keys properly as a v2 feature.
- Added "Members" back to the navigation under the Identity section.
- Removed the two dead audit enum values and created a database migration.
- Updated all doc cross-references to point to the v2 roadmap.
- Fixed the broken Next.js install by restoring the committed version.

Takeaway: claims drift from reality. A number written in a doc is a bug
waiting to happen. The worst drift is a frontend feature with no backend —
it compiles, it tests green, and it's still wrong. Regular sweeps keep the
truth honest.

--------------------------------------------------------------------------------

## Chapter 2 -- The Security That Wasn't Actually There
--------------------------------------------------------------------------------
We thought the system was secure-by-design. Then a sweep asked: did the code
actually enforce the things the docs promised? Five gaps said no:

  - The credential verifier assumed one signing algorithm (ES256), ignoring the
    algorithm in the token header — so a key rotation to anything else would
    silently use the wrong key.
  - The signing service crashed with a 500 whenever someone tried to use an
    identity-level key for issuance — no clear error, no path forward.
  - The status-list index allocator had a race: two requests could grab the same
    slot at the same time, corrupting the list.
  - Federated login auto-linked accounts by email without checking if the email
    was actually verified — anyone with an unverified social account could
    claim an existing user's identity.
  - The database seed script used a hardcoded password in production when the
    ADMIN_PASSWORD env var was missing.

Root cause:
  Security was described in prose and intent, not asserted in code. The
  invariants existed as assumptions, not checks.

The fix:
  Each gap was patched at the source: the verifier now reads the algorithm from
  the JWT header; the signing service returns a clear 4xx (identity-level
  signing deferred to v2); the index allocator uses a compare-and-swap with
  retry; federated auto-link requires emailVerified === true; the seed script
  requires ADMIN_PASSWORD in production and rejects the known dev default.

Takeaway: a security property that isn't checked in code is a promise waiting to
break. Security claims must be traceable to a line of code, not just a paragraph.

--------------------------------------------------------------------------------

## Chapter 3 -- The Button That Led Nowhere
--------------------------------------------------------------------------------
The console had a full "API Keys" page — a table, a "Create Key" button, a
revoke flow — with a hook that returned stub data. Click "create" and it
returned "not implemented." The page looked real. It was not. The backend had
no API key model, no routes, no flows. An entire UI for a feature that
doesn't exist.

Root cause:
  Frontend and backend evolved on separate tracks with no shared contract gate.
  The frontend team built the UI thinking the backend existed; the backend
  never built it. Both were internally correct (the UI renders; the backend
  doesn't crash) but together they shipped fiction.

The fix:
  Deleted the page, the hook, and the nav link. API keys will be built properly
  as a v2 feature — UI and backend together, from a shared contract.

Takeaway: a frontend page for a non-existent backend is the fastest kind of
drift — it compiles, it tests green, it passes CI, and it's still entirely
wrong. Every UI must have a backend counterpart before it ships.

--------------------------------------------------------------------------------

## Chapter 4 -- The Branches That Wouldn't Merge Cleanly
--------------------------------------------------------------------------------
The repo didn't grow on one branch — it grew on several. There was a "stabilization"
branch with WIP work, a "main" branch, local state that hadn't been synced, and
at least three merge PRs trying to reconcile them. Each stabilization branch was
a parallel universe that diverged from main and then had to be pulled back in —
doubling the work and multiplying merge conflicts.

Root cause:
  Work was staged on long-lived branches instead of trunk. By the time it merged,
  the branch had diverged, and every file it touched had to be reconciled twice.

The fix:
  Collapsed everything back to main. Subsequent work went to main directly with
  short-lived feature branches. The merge storms stopped.

Takeaway: a branch is a parallel universe — one cost to write, one to merge.
Trunk-first with small, frequent commits keeps the story honest. Long-lived
branches cost double.

--------------------------------------------------------------------------------

## Chapter 5 -- The Computer That Broke Between Sessions
--------------------------------------------------------------------------------
The local environment is where things go quietly wrong:

  - A JSON config file got corrupted by an IDE crash (null bytes) — it sat
    broken until something tried to read it.
  - Next.js was bumped to a new version in package.json, but the install was
    never run — so TypeScript couldn't find the `next` module. CI didn't catch it
    (frozen lockfile), but any developer who pulled the branch had a broken
    build.
  - Temp files accumulated in the working tree, and one 3.1 MB snapshot file
    was tracked in git despite being on the ignore list.

Root cause:
  The local tree is a claim, not ground truth. A package.json change without a
  matching lockfile is a lie that only the developer's machine can tell. An IDE
  crash mid-save can corrupt any file, and nothing catches it until it's read.

The fix:
  Cleaned up the temp files + snapshot; restored Next.js to the committed
  version; added null-byte checks. The lesson: a package.json bump without an
  install is invisible to CI, and a crash mid-save is a latent corruptor.

Takeaway: environment claims need gates, not hope. The local tree is always one
crash away from lying to you.

--------------------------------------------------------------------------------

## Chapter 6 -- The Green Checkmark That Lied
--------------------------------------------------------------------------------
CI was green throughout the audit sweep: 342 tests passing, typecheck clean.
But the tree it was green on contained:

  - Two audit-log enum values ("DELEGATION_GRANTED", "DELEGATION_REVOKED") that
    no code anywhere ever produced — dead weight, never removed.
  - Docs claiming "src/components/ui/ was deleted" — but it still had 3 files.
  - Counts that were wrong everywhere: README said 62 files / 340 tests
    (reality: 61 / 342); 16 permissions (reality: 19); 5 policy fields (reality: 6);
    53 enum values (reality: 51).

Root cause:
  CI verifies that code compiles and tests pass — not that prose matches reality.
  A dead enum, a stale count, a vanished-but-present folder — none of these fail
  a compiler, but all of them make the repo a lie.

The fix:
  The audit sweep corrected every count, deleted the dead code, and fixed the
  prose. But CI itself didn't catch any of it — a human audit did.

Takeaway: green CI is evidence the code compiles, not that the claims are true.
A gate that only runs tests signs off on a lie. Prose counts are bugs waiting to
happen.

--------------------------------------------------------------------------------

## Chapter 7 -- The Story That Ran Ahead of the Truth
--------------------------------------------------------------------------------
The .agent tracker, CLAUDE.md, and AGENTS.md are the canonical story of where
the repo stands — but they're prose claims (numbers, statuses, roadmap
references) that drift from the code the moment it changes. The audit sweep
found the tracker saying "16 permissions" when the code had 19; "5 policy
fields" when the code had 6; "53 enum values" when the code had 51.

This is the same trap facet fell into: their local tracker said a store
package was "published at 0.1.0" when it only existed on disk — the tracker
had outrun the git tags.

Root cause:
  The tracker is a claim written between sessions, updated to match what's on
  disk — not what's been committed or released. It diverges the instant code
  changes.

The fix:
  Re-synced the tracker to reality in the audit sweep. But it's still prose —
  it will drift again the moment the next change lands.

Takeaway: the tracker is a claim, not a fact. Sync it to git tags after every
release, not to local bumps. If a count lives in prose, it's already wrong.

--------------------------------------------------------------------------------

## Chapter 8 -- The Great Dependency Swap
--------------------------------------------------------------------------------
The frontend was a tangle. Some pages used the new facet SDK; others used
in-repo hooks. Some used facet components; others used deleted shadcn wrappers.
Auth forms existed in-repo while facet-auth was available. The in-repo
factory-pattern SDK lived alongside the published @arcevo/facet-sdk. No reader
could follow the dependency graph.

Root cause:
  The migration replaced consumers one-by-one instead of migrating the shared
  primitive first. Each consumer was half-migrated, creating a hybrid that
  nobody owned.

The fix:
  A phased migration — SDK first, then UI primitives (components, tokens), then
  layouts, then auth flows. Each phase migrated the shared primitive, updated
  ALL consumers, and deleted the old code in one cut. After Phase 6, the in-repo
  SDK files were deleted; src/sdk/index.ts became a thin singleton that wires
  the published facet SDKs.

Takeaway: a migration that replaces consumers one-by-one creates a tangle.
Migrate the shared primitive first, then flip every consumer at once — one cut,
clean.

--------------------------------------------------------------------------------

## Chapter 9 -- The Tests That Caught What Individual Fixes Missed
--------------------------------------------------------------------------------
Phase 0 shipped the backend (server 0.1.0) as a set of individually-correct flows
— each flow worked, each test passed. But the system had never been exercised
end-to-end against a real tenant with real cross-tenant boundaries. The
hardening phase asked the cross-cutting questions:

  - Can a tenant's request reach another tenant's data? -> A cross-tenant HTTP
    integration test (3 tests, fastify.inject) was added and passes.
  - Can an outbound fetch to a user-supplied URL be weaponized (SSRF)? -> 4 call
    sites were closed (idp OIDC discovery + token endpoint, webhook test-ping,
    SAML entryPoint); every outbound fetch now passes through assertSafeUrl().
  - Can a revoked token still be used? -> Redis-backed distributed revocation:
    deleting a session now blocks all bound access tokens + JTIs.
  - Are we flying blind on failures? -> Pino structured logs carry a traceId
    on every flow; GET /metrics exposes fastify-metrics.

Root cause:
  Individual correctness is not system correctness. Each fix made one flow
  safe; none of them proved the system was safe as a whole.

The fix:
  Turned every invariant into an assertion: cross-tenant data -> integration
  test; outbound fetch -> URL gate; token revocation -> blocklist + DB write
  together; observability -> correlation IDs + metrics endpoint.

Takeaway: the hard questions are cross-cutting. "Can tenants see each other?"
"Can a URL be weaponized?" "Can a token outlive its revocation?" Answer each
with a test, not a hope. The worst bug is one your tests can't reach.

--------------------------------------------------------------------------------
END
