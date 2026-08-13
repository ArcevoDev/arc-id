# ArcID / Facet Client-Core Architecture Analysis

> Context: should the SDK + store + hooks + CLI move out of arc-id into a
> new workspace/repo (working name "beacon"), with facet staying UI/docs
> only? Plain analysis, grounded in the current repo state.

Date: 2026-08-13

---

## 1. Where we actually are today (verified)

- `@arcevo/facet-sdk@1.0.1` is PUBLISHED and consumed by BOTH arc-id and
  arc-wallet as a dependency. The SDK boundary already exists.
- arc-id still owns, in-repo: `src/store/` (auth, tenant, ui) and
  `src/hooks/` (13 use-* hooks). These wrap the facet-sdk.
- arc-wallet REIMPLEMENTED its own `src/stores/auth-store.ts` and
  `src/services/*` because the shared hooks/stores do not exist as a
  package. This is the duplication the architecture should kill.
- `@arcevo/facet-cli@0.3.0` is already published (installed in arc-id,
  unused so far) and `@arcevo/facet-docs@1.3.0` is published.
- facet repo already publishes: sdk, components, auth, layout, tokens,
  cli, docs. It is a multi-package monorepo today.

## 2. The model you are describing (recap)

- facet = UI + docs only (components, layout, tokens, auth UI).
- NEW workspace ("beacon") = the client core: SDK + store + hooks + CLI.
- arc-id and arc-wallet consume the new workspace packages, no local
  store/hooks duplication.

## 3. Plain verdict: sound direction, one correction

The SPLIT (client-core vs UI) is correct and is the classic
"headless SDK + UI kit" architecture. The CORRECTION is WHERE it lives.

Putting the SDK in a second repo while facet already owns facet-sdk
splits one trust/versioning boundary across two repos. The ecosystem is
already a monorepo. The clean move:

    facet (existing monorepo, one versioning + publish pipeline)
      ├─ @arcevo/facet-sdk        (exists - the headless client)
      ├─ @arcevo/facet-store      (NEW - zustand stores, framework-agnostic)
      ├─ @arcevo/facet-react      (NEW - the use-* hooks, React only)
      ├─ @arcevo/facet-cli        (exists - the CLI)
      ├─ @arcevo/facet-components (exists - UI)
      ├─ @arcevo/facet-layout     (exists - shells)
      └─ @arcevo/facet-tokens     (exists - design tokens)

Arc-id + arc-wallet become thin apps: no in-repo store/hooks, everything
from @arcevo/facet-store / @arcevo/facet-react.

This gives: one version line, one publish, no drift, apps stay small.

## 4. Why "beacon" as a second repo is architectural debt (be plain)

- Two repos must coordinate releases (a store change that needs an SDK
  change becomes a cross-repo dance).
- facet-sdk already carries the auth/refresh/error envelope logic; the
  store is a thin wrapper over it. Splitting them across repos adds
  friction for almost zero gain.
- The name is great for the PRODUCT/brand (the identity client you hand
  to integrators). Keep "beacon" as the product line: "Beacon - the
  ArcID client". Ship it FROM the facet monorepo.

## 5. The actual work this unlocks (what to build)

- @arcevo/facet-store: extract arc-id's auth.store + tenant.store +
  ui.store into a published package. Token persistence becomes an
  injectable adapter (localStorage for web, expo-secure-store for RN)
  so arc-wallet stops re-implementing auth-store.
- @arcevo/facet-react: extract the 13 use-* hooks. The hooks take the
  SDK client as input (or read a default singleton) and return the same
  { data, error } shapes. arc-id and arc-wallet import these, keeping
  the page -> hook -> store -> SDK -> API convention.
- Wire the CLI (facet-cli already installed) to a real `arcid` command.
- Keep arc-id's src/sdk/index.ts as the SINGLE wiring point that
  constructs the client + wires onTokenRefresh, then everything else
  consumes the published packages.

## 6. Risks / honest caveats

- This is a refactor of the frontend foundation AFTER the pages are
  built. Order matters: finish the page-wiring phases first, THEN extract
  the packages (extraction is mechanical; rewriting pages twice is not).
- The wallet currently works with its own auth-store. Moving to
  @arcevo/facet-store means a one-time migration of secure-store
  persistence into the adapter model.
- Versioning: facet-sdk is 1.0.1 (stable-ish). The new packages start at
  0.x until consumed by both apps.

## 7. Recommendation (plain)

Do the split. Keep it in the facet monorepo (no second repo). Brand the
product "beacon" for the identity-client story. Sequence:

1. Finish arc-id page wiring (Phase E) + wallet polish.
2. Extract @arcevo/facet-store (auth/tenant/ui stores + persistence
   adapter) from arc-id.
3. Extract @arcevo/facet-react (the 13 hooks) from arc-id.
4. Migrate arc-wallet to consume both (kills its duplicate auth-store).
5. Wire the CLI to real arcid commands.
6. Rebrand the client story as beacon for integrators/docs.

## 8. Open questions before grounding it

- Does the facet repo OWN these new packages, or do you still want a
  distinct beacon repo for political/branding reasons? (Architecturally
  one repo is better; brand can still be beacon.) - i believe leaving it under facet is a better choice, we could jsut give the naming direction in their respective pkg files.. like @arcevo/beacon-* or just leave as facet --- since it also carries a weighty meaning... whichever you think is best...
- Do we keep arc-id's src/sdk/index.ts as the client singleton forever,
  or move it into facet-store as the default export? depends on how the canonical identity is planned to be conumed across tenants and project.. since we are working against duplicated users auth... where any integrator system uses the single canonical identity of a specific user to verify claims and personality across systems and sectors... solving the identity fragmentation... or what'd you think....
- Scope of CLI for v1: init/doctor/migrate/setup (from the existing
  arcid-cli-design.md) or a smaller surface first? wwhatever the best convention is.... at thhis point.. i am a bit lost...
