# ArcID / Facet Client-Core Architecture - Canonical Conventions

> Purpose: the single source of truth for how the ArcID client core
> (SDK, stores, hooks, CLI) is packaged, named, and consumed across
> arc-id, arc-wallet, and any future integrator. This replaces the
> earlier split-vs-stay analysis with a definitive, framework-agnostic
> convention set, reconciled with what is actually shipped.

Date: 2026-08-15 (rewritten)

---

## 1. The one rule: headless core + thin UI kit, one monorepo

The client core and the UI kit ship from **one versioning + publish
pipeline** (the facet monorepo). No second repo. This is the classic
"headless SDK + UI kit" split done the low-friction way: one release
line, no cross-repo coordination, apps stay thin.

```
facet monorepo (single versioning + publish)
├─ @arcevo/facet-sdk        headless client (pure fetch, zero UI)
├─ @arcevo/facet-store      framework-agnostic stores (zustand) + injectable persistence [DONE - @arcevo/facet-store@^0.1.0, src/store/ deleted]
├─ @arcevo/facet-cli        the CLI (docs/emails init, add, icons, pkg/doctor/update/up)
├─ @arcevo/facet-components UI kit (React + Radix, incl. animation family)
├─ @arcevo/facet-layout     shells (Console/Auth/Landing)
├─ @arcevo/facet-auth       auth UI + presets (copy-flexible forms)
├─ @arcevo/facet-emails     framework-agnostic email templates + preview server
├─ @arcevo/facet-tokens     design tokens
└─ @arcevo/facet-docs       installable docs engine
```

Branding: the product line name is a product decision, not an
architecture one. Package names stay `@arcevo/facet-*`.

## 2. Dependency direction (non-negotiable)

Layering is strict and one-way. Lower layers never import higher ones.

```
page → component → hook (use-*) → store (facet-store) → SDK (facet-sdk) → API
```

- `facet-sdk` imports nothing from the other facet packages (pure fetch,
  zero UI, zero React).
- `facet-store` depends only on `facet-sdk` + an injectable persistence
  adapter. No React. Export store *creators*, not singletons.
- Components/layout/auth depend on the layers below only through props,
  slots, and config - never by reaching into internals.
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
  so claims resolve consistently across tenants and projects.
- Persistence is an injected adapter (localStorage for web,
  expo-secure-store for RN) so arc-wallet stops re-implementing
  auth-store.

## 4. Package conventions (agnostic + portable)

- **SDK**: pure fetch, dependency-free, typed domain classes
  (`AuthSdk`, `TenantSdk`, `VcSdk`, `OAuthSdk`, `PasskeySdk`, `IdpSdk`,
  ...). Works in browser, Node, edge. No React.
- **Store** (planned): zustand stores extracted from arc-id
  (`auth.store`, `tenant.store`). Framework-agnostic. Token persistence
  via an injected adapter interface. React agnostic. The stores are
  PURE today (auth imports only `create` + the `User` type; tenant
  imports only `create`) - fully extractable as-is.
- **Hooks**: stay in the consumer for now. The 13 use-* hooks import
  `@/sdk` (the app wiring singleton) + `@/store/*` - app-specific glue
  (base URL, localStorage keys, 401 refresh). They are NOT extractable
  until a dependency-inversion refactor makes the client injectable.
  Web/mobile devs own their hooks; the store is the shared agnostic
  layer.
- **CLI**: `facet docs init` / `docs scan` / `emails init` / `add` /
  `icons generate` / `pkg` / `doctor` / `update` / `up` / `clean` /
  `scripts` / `prep`. Commands EXECUTE real tasks, never silently
  assume. `facet update` auto-applies (confirm prompt, `-y` skips).
  Packages are discovered dynamically from the npm `@arcevo` scope, so
  new packages appear without a CLI release.
- **UI**: components/layout/auth are domain-customizable (fintech/med/
  edu/enterprise presets), never hardcoded. Every surface accepts
  overrides (children, slots, config, and a `copy` prop on forms) rather
  than baking in copy or colors.
- **Emails**: `@arcevo/facet-emails` renders template trees (React or
  plain) to HTML/text with zero runtime deps; brand tokens via the
  renderer options; dev preview server on port 3888.

## 5. The wiring point convention

Each app keeps ONE wiring file (arc-id's `src/sdk/index.ts` pattern):

1. Construct `ArcIdClient` with base URL + token storage.
2. Wire `onTokenRefresh` to the auth store.
3. Export the client singleton.
4. Everything else imports from the published packages.

This keeps the chain intact and makes the app trivially portable to any
backend shape. The 401 auto-refresh re-entrancy guard lives here.

## 6. Sequencing (what unlocks what)

1. Finish arc-id page wiring + wallet polish (do NOT extract while pages
   are mid-rewrite - extraction is mechanical, rewriting pages twice is
   not).
2. Confirm the SDK contract with a live e2e (register -> login ->
   session restore -> MFA) against the running API.
3. Extract `@arcevo/facet-store` (auth/tenant stores + persistence
   adapter) from arc-id. Migrate arc-id `src/store/*` to thin re-exports
   from the package; update `src/sdk/index.ts` to pass localStorage
   storage + keys.
4. Decide on `@arcevo/facet-react` (the hooks) separately, only after a
   dependency-inversion refactor makes the client injectable. Until
   then, hooks stay in-app.
5. Migrate arc-wallet to consume the store (kills its duplicate
   auth-store).
6. Rebrand the client story as the product line for integrators/docs.

## 7. Risks (honest)

- Order matters: finish page wiring before extraction.
- Wallet migration: one-time move of secure-store persistence into the
  adapter model.
- Versioning: new packages start at 0.x until consumed by both apps.
- The strict chain has pragmatic exceptions today (some pages import
  SDK directly). Those are acceptable, tracked, and should shrink.
- Hooks extraction is blocked on the injectable-client refactor; do not
  cut-and-paste the singleton wiring into a package.

## 8. Decisions (recorded)

- One monorepo (facet) owns the client core + UI. No second repo.
- The product line name is a product decision, not a package scope.
- The SDK singleton stays in the app wiring file (convention 5), not a
  package default export - keeps the app in control of env/token wiring.
- `@arcevo/facet-store` exports store creators + takes an injected
  storage adapter; no hardcoded localStorage keys or URLs in the
  package.
- Hooks stay in-app until the injectable-client refactor; web/mobile
  devs own their hooks.
- CLI v1 surface: docs/emails init, add, icons, pkg/doctor/update/up.
