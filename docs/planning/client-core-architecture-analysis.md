# ArcID / Facet Client-Core Architecture — Canonical Conventions

> Purpose: the single source of truth for how the ArcID client core
> (SDK, stores, hooks, CLI) is packaged, named, and consumed across
> arc-id, arc-wallet, and any future integrator. This replaces the
> earlier split-vs-stay analysis with a definitive, framework-agnostic
> convention set.

Date: 2026-08-13 (rewritten)

---

## 1. The one rule: headless core + thin UI kit, one monorepo

The client core and the UI kit ship from **one versioning + publish
pipeline** (the facet monorepo). No second repo. This is the classic
"headless SDK + UI kit" split done the low-friction way: one release
line, no cross-repo coordination, apps stay thin.

```
facet monorepo (single versioning + publish)
├─ @arcevo/facet-sdk        headless client (pure fetch, zero UI)
├─ @arcevo/facet-store      framework-agnostic stores (zustand) + injectable persistence
├─ @arcevo/facet-react      the use-* hooks (React only, thin over store/SDK)
├─ @arcevo/facet-cli        the CLI (facet pkg / doctor / update / up / clean / prep)
├─ @arcevo/facet-components UI kit (React + Radix)
├─ @arcevo/facet-layout     shells (Console/Auth/Landing)
├─ @arcevo/facet-auth       auth UI + presets
├─ @arcevo/facet-tokens     design tokens
└─ @arcevo/facet-docs       installable docs engine
```

Branding: "beacon" is the PRODUCT line (the identity client integrators
adopt). It is shipped from the facet packages — the package names stay
`@arcevo/facet-*` unless a future product decision renames the scope.
Naming direction is a product decision, not an architecture one.

## 2. Dependency direction (non-negotiable)

Layering is strict and one-way. Lower layers never import higher ones.

```
page → component → hook (use-*) → store (facet-store) → SDK (facet-sdk) → API
```

- `facet-sdk` imports nothing from the other facet packages (pure fetch,
  zero UI, zero React).
- `facet-store` depends only on `facet-sdk` + an injectable persistence
  adapter. No React.
- `facet-react` depends on `facet-store` + `facet-sdk` + React. No UI.
- Components/layout/auth depend on the layers below (hooks/store/sdk)
  only through props or thin wrappers — never by reaching into internals.
- Apps (arc-id, arc-wallet) are thin: they wire the singleton once and
  consume published packages. No in-repo store/hooks duplication.

## 3. Canonical identity (the actual product problem)

The product problem is **identity fragmentation**: a single user's
canonical identity should verify claims across systems and sectors. The
architecture convention:

- `@arcevo/facet-sdk` exposes the canonical identity client: one
  `ArcIdClient` per environment (constructed in the app's wiring point,
  e.g. `src/sdk/index.ts`), with 401 auto-refresh wired once.
- Every integrator constructs the client the same way and hands it to
  the store/hooks. There is no per-app reimplementation.
- The store keeps ONE canonical session shape (from `facet-sdk` types),
  so claims (aal, preferred_username, memberships, wallet DID) resolve
  consistently across tenants and projects.
- Persistence is an injected adapter (localStorage for web,
  expo-secure-store for RN) so arc-wallet stops re-implementing
  auth-store.

## 4. Package conventions (agnostic + portable)

- **SDK**: pure fetch, dependency-free, typed domain classes
  (`AuthSdk`, `TenantSdk`, `VcSdk`, `OAuthSdk`, `PasskeySdk`, `IdpSdk`,
  ...). Works in browser, Node, edge. No React.
- **Store**: zustand stores extracted from arc-id (`auth.store`,
  `tenant.store`, `ui.store`). Framework-agnostic. Token persistence via
  adapter interface. React 18/19 agnostic.
- **Hooks**: the 13 use-* hooks take the client as input (or read a
  default singleton) and return `{ data, error }` shapes. React only.
- **CLI**: `facet pkg / doctor / update / up / clean / prep` —
  commands must EXECUTE real tasks, never silently assume. A registry
  hiccup is surfaced (warn, non-zero exit), never reported as
  "up to date".
- **UI**: components/layout/auth are domain-customizable (fintech/med/
  edu/enterprise presets), never hardcoded. Every surface accepts
  overrides (children, slots, config) rather than baking in copy or
  colors.

## 5. The wiring point convention

Each app keeps ONE wiring file (arc-id's `src/sdk/index.ts` pattern):

1. Construct `ArcIdClient` with base URL + token storage.
2. Wire `onTokenRefresh` to the auth store.
3. Export the client singleton.
4. Everything else imports from the published packages.

This keeps the "page → hook → store → SDK → API" chain intact and makes
the app trivially portable to any backend shape.

## 6. Sequencing (what unlocks what)

1. Finish arc-id page wiring (Phase E) + wallet polish (do NOT extract
   while pages are mid-rewrite — extraction is mechanical, rewriting
   pages twice is not).
2. Extract `@arcevo/facet-store` (auth/tenant/ui stores + persistence
   adapter) from arc-id.
3. Extract `@arcevo/facet-react` (the 13 hooks) from arc-id.
4. Migrate arc-wallet to consume both (kills its duplicate auth-store).
5. Wire the CLI to real `arcid` commands (init/doctor/migrate/setup
   surface, per arcid-cli-design.md).
6. Rebrand the client story as beacon for integrators/docs.

## 7. Risks (honest)

- Order matters: finish page wiring before extraction.
- Wallet migration: one-time move of secure-store persistence into the
  adapter model.
- Versioning: new packages start at 0.x until consumed by both apps.
- The strict chain has pragmatic exceptions today (some pages import
  SDK directly). Those are acceptable, tracked, and should shrink.

## 8. Decisions (recorded)

- One monorepo (facet) owns the client core + UI. No second repo.
- "beacon" is a product brand, not a package scope.
- The SDK singleton stays in the app wiring file (convention 5), not a
  package default export — keeps the app in control of env/token wiring.
- CLI v1 surface: init/doctor/migrate/setup, grown from what
  arcid-cli-design.md specifies.
