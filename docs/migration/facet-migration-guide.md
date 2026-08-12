# arc-id → facet Migration Guide

> **Target**: Replace arc-id's in-repo shadcn/ui components, auth UI, and SDK
> client with the published `@arcevo/facet-*` packages.
>
> **Status (2026-08-12)**: Phases 0–3 DONE. `@arcevo/facet-sdk@1.0.1`
> verified complete against arc-id's registered routes (2026-08-04);
> `@arcevo/facet-tokens/tokens.css` wired (Phase 2); `src/components/ui/`
> deleted and all consumers on `@arcevo/facet-components@1.3.0` (Phase 3).
> Phases 4–6 (auth forms, layout, purge) are the remaining work queue.
> All six facet packages are published to npm and pinned in package.json.
> See `docs/planning/arcid-v1-roadmap.md` for overall project state.

---

## Overview

arc-id currently duplicates two things that the facet packages now own from
a single source of truth:

| Duplicated in arc-id | Replaced by | Files affected |
|---|---|---|
| ~~`src/components/ui/*` (shadcn components)~~ | ✅ `@arcevo/facet-components` — **done (2026-08-12)** | ~25 files, all migrated, dir deleted |
| `src/components/auth/*` (LoginForm, RegisterForm, etc.) | `@arcevo/facet-auth` | ~6 files — Phase 4 (pending) |
| ~~`src/sdk/*` (client + 10 domain SDKs)~~ | ✅ `@arcevo/facet-sdk` — **done (2026-08-05)** | ~13 files, dir reduced to `index.ts` |

**What arc-id keeps**: layout components (`src/components/layout/`), pages
(`src/app/`), Zustand stores (`src/store/`), hooks (`src/hooks/`), nav config,
providers, and CSS custom utilities.

### Published versions (pin exact — no `^`)

| Package | Version |
|---|---|
| `@arcevo/facet-sdk` | 1.0.1 |
| `@arcevo/facet-components` | 1.3.0 |
| `@arcevo/facet-auth` | 1.1.1 |
| `@arcevo/facet-layout` | 1.2.0 |
| `@arcevo/facet-tokens` | 1.1.0 |
| `@arcevo/facet-cli` | 0.3.0 (installed — basis for `packages/cli` work) |
| `@arcevo/facet-docs` | 1.3.0 (installed — docs scaffold basis) |

---

## Migration Order

Each phase is reversible within a single commit — you can always revert.
Do them in order, testing after each phase.

---

### Phase 0 — Add `@arcevo/facet-*` as dependencies

```sh
pnpm add @arcevo/facet-sdk@1.0.1 @arcevo/facet-auth@1.1.1 @arcevo/facet-components@1.3.0 @arcevo/facet-tokens@1.1.0 @arcevo/facet-layout@1.2.0 @arcevo/facet-cli@0.3.0 @arcevo/facet-docs@1.3.0
```

Exact pins are intentional — the components/auth/layout packages have no test
suite yet, so pinning protects against a breaking bump mid-rebuild. Bump via a
deliberate `pnpm add @arcevo/facet-*@latest` after reviewing the changelog.

---

### Phase 1 — Replace `src/sdk/` with `@arcevo/facet-sdk`

This is the most mechanical change. arc-id's SDK uses factory functions wired
to Zustand (`createAuthSdk(client)`, `createTenantSdk(client)`, etc.).
facet-sdk uses classes (`new AuthSdk(client)`).

**Keep** the token-refresh orchestration and the Zustand-wired singleton.
**Replace** the domain SDKs with facet-sdk classes:

```diff
- import { createAuthSdk } from "./auth.sdk";
+ import { AuthSdk } from "@arcevo/facet-sdk";
- const authSdk = createAuthSdk(client);
+ const authSdk = new AuthSdk(client);
```

The response shapes are identical (`{ data, error }`); the facet client unwraps
the `{ success, data }` envelope by default and uses `bare: true` for the
protocol/public endpoints — already matching arc-id's routes.

The `ArcIdClient` takes `onTokenRefresh` + `onAuthCleared` callbacks — wire
them to the Zustand auth store exactly like the current inline client.

**After phase 1 is green, DELETE `src/sdk/*.sdk.ts`** (keep only the client +
singleton orchestration, or re-export facet-sdk directly from hooks).

---

### Phase 2 — Replace CSS variables — ✅ DONE (2026-08-12)

Done in the working tree:

1. Import facet-tokens BEFORE the existing globals.css:

```ts
// src/app/layout.tsx — at the top of imports
import "@arcevo/facet-tokens/tokens.css";
import "@/styles/globals.css";
```

2. In `src/styles/globals.css`, **kept**:
   - Font family declarations (`--font-sans`, `--font-mono`, `--font-heading`)
   - `@tailwindcss` + `tw-animate-css` imports
   - Sidebar tokens (`--sidebar-*`)
   - Chart tokens (`--chart-*`)
   - `@utility` blocks (`glow-indigo`, `border-glow`, `glass`, `text-gradient`)
   - `@layer base` styles

3. **Removed** from `globals.css`:
   - `:root { --background: ... }` through `--radius` — facet-tokens' `tokens.css`
     provides these (same OKLCH values, same variable names — verified).

**Design token conflict note**: arc-id uses indigo (`oklch(0.58 0.23 273)`) as its
primary. facet-tokens uses Electric Cyan (`#4AD3F5` / `oklch(0.78 0.18 200)`) per
the Alpha Palette. **Resolved in favour of arc-id's indigo**: `globals.css`
overrides the tokens after the facet-tokens import, and the custom utilities
(glow-indigo, text-gradient, focus rings) keep the indigo identity.

---

### Phase 3 — Replace `src/components/ui/` with `@arcevo/facet-components` — ✅ DONE (2026-08-12)

Mechanical find-and-replace. The components share the same Radix primitives,
named exports, and props.

```diff
- import { Button } from "@/components/ui/button";
+ import { Button } from "@arcevo/facet-components";
```

**Icons — do NOT recreate a local registry.** `@arcevo/facet-components@1.3.0`
ships a full icon registry: `<Icon name="…" />` resolves semantic aliases
(`settings`, `logout`, `menu`) plus **any** lowercase lucide kebab name
(`shield-check`, `chevron-down`, `chart-column`, …). Resolution order is
`IconProvider` overrides → `registerIcon` global → built-in semantic map →
lucide map. For dynamic icons (e.g. sidebar nav) pass the name as a string:

```tsx
import { Icon } from "@arcevo/facet-components";
<Icon name="shield" className="h-4 w-4" />     // semantic
<Icon name="shield-check" className="h-4 w-4" /> // any lucide name
```

The old in-repo `src/lib/ui/icon-registry.ts` (a hand-rolled `Icons` map) and
the duplicate `src/lib/ui/navigation.ts` were **deleted** — both were dead
duplicates of what the facet package ships. `@/lib/utils` now just
re-exports facet's `cn`.

**After phase 3 is green, DELETE `src/components/ui/`** — done; the directory
is removed and no `@/components/ui/` imports remain.

---

### Phase 4 — Replace `src/components/auth/` with `@arcevo/facet-auth`

This is the most significant behavioral change. arc-id's auth components are
simple inline forms. facet-auth's use a state machine.

arc-id old → facet new mapping:

| Old | New | Notes |
|---|---|---|
| `<LoginForm />` | `<SignIn config={eduPreset} />` | SignIn wraps method selection, MFA, passkey into one state machine |
| `<RegisterForm />` | `<SignUp />` | Direct replacement — same fields |
| `<MfaForm />` | `<MfaDialog />` | MfaDialog includes setup + confirm + recovery in one component |
| `<ForgotPasswordForm />` | `<ForgotPasswordForm />` | Also importable standalone from `@arcevo/facet-auth` |
| `auth/useAuth()` | `@arcevo/facet-auth`'s `useAuth()` | Returns provider-backed actions instead of Zustand-backed |

**Critical architectural difference** — arc-id's auth is driven by Zustand
stores (`useAuthStore`). facet-auth's is driven by React context
(`ArcProvider`). You can run both side-by-side during migration:

```tsx
// During transition — ArcProvider manages UI state, Zustand persists tokens
<ArcProvider client={arcIdClient}>
  <OldAuthProvider>  {/* keep your Zustand hydration */}
    <App />
  </OldAuthProvider>
</ArcProvider>
```

The `ArcProvider` from @arcevo/facet-auth stores tokens via `TokenStorage`
(defaults to localStorage). arc-id's `useAuthStore` reads from localStorage
in its `AuthProvider`. They'll stay in sync as long as both read/write the
same localStorage keys.

**To fully unify**: make arc-id's `useAuthStore` the single source of truth
and pass a custom `TokenStorage` to ArcProvider that writes to the Zustand
store instead of localStorage.

**MFA verification**: confirm facet-auth's MfaDialog is wired to the real
`authSdk.verifyMfa()` flow (the old placeholder stub must be resolved) before
cutting over.

---

### Phase 5 — Layout

Adopt `@arcevo/facet-layout` shells (ConsoleLayout/AuthLayout) or keep
arc-id's layout wrapper initially and migrate incrementally. The layout
package is framework-agnostic (slot-based, no routing dependency).

---

### Phase 6 — Purge old files

After all phases are green across the full test suite:

```sh
git rm -r src/components/ui/
git rm -r src/components/auth/
# src/sdk/ — keep the client/orchestration, remove the individual .sdk.ts files
```

---

## Rolling back

Each phase is a separate commit. If a phase breaks tests, `git revert` that
phase's commit. The old files aren't deleted until Phase 6.

---

## Verification checklist

| Check | How |
|---|---|
| `pnpm typecheck` | Clean across all phases |
| `pnpm test` | All 340 tests passing |
| `pnpm dev:all` | Manual smoke test: login, register, MFA, tenant switch, passkey |
| Facet docs match | Compare facet's docs gallery against rendered components in arc-id |
| CSS regression | Sidebar, Topbar, TenantSwitcher, and pages render with correct colors |

---

_Guide updated 2026-08-12 — Phases 0–3 done (SDK + CSS tokens + components).
Phase 4 (auth forms) is the next work item. All six facet packages pinned
at their latest verified versions (sdk 1.0.1, components 1.3.0, auth 1.1.1,
layout 1.2.0, tokens 1.1.0, cli 0.3.0, docs 1.3.0)._
