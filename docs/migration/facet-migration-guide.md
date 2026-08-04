# arc-id → facet Migration Guide

> **Target**: Replace arc-id's in-repo shadcn/ui components, auth UI, and SDK
> client with the published `@arcevo/facet-*` packages.
>
> **Status**: `@arcevo/facet-sdk@1.0.1` verified complete against arc-id's
> registered routes (2026-08-04). All six facet packages are published to npm.
> This guide is the execution plan. See `docs/planning/arcid-v1-roadmap.md`
> for overall project state.

---

## Overview

arc-id currently duplicates three things that the facet packages now own from
a single source of truth:

| Duplicated in arc-id | Replaced by | Files affected |
|---|---|---|
| `src/components/ui/*` (shadcn components) | `@arcevo/facet-components` | ~25 files |
| `src/components/auth/*` (LoginForm, RegisterForm, etc.) | `@arcevo/facet-auth` | ~6 files |
| `src/sdk/*` (client + 10 domain SDKs) | `@arcevo/facet-sdk` | ~13 files |

**What arc-id keeps**: layout components (`src/components/layout/`), pages
(`src/app/`), Zustand stores (`src/store/`), hooks (`src/hooks/`), nav config,
providers, and CSS custom utilities.

### Published versions (pin exact — no `^`)

| Package | Version |
|---|---|
| `@arcevo/facet-sdk` | 1.0.1 |
| `@arcevo/facet-components` | 1.1.0 |
| `@arcevo/facet-auth` | 1.0.3 |
| `@arcevo/facet-layout` | 1.1.0 |
| `@arcevo/facet-tokens` | 1.0.1 |

---

## Migration Order

Each phase is reversible within a single commit — you can always revert.
Do them in order, testing after each phase.

---

### Phase 0 — Add `@arcevo/facet-*` as dependencies

```sh
pnpm add @arcevo/facet-sdk@1.0.1 @arcevo/facet-auth@1.0.3 @arcevo/facet-components@1.1.0 @arcevo/facet-tokens@1.0.1 @arcevo/facet-layout@1.1.0
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

### Phase 2 — Replace CSS variables

1. Import facet-tokens BEFORE the existing globals.css:

```ts
// src/app/layout.tsx — at the top of imports
import "@arcevo/facet-tokens/tokens.css";
import "@/styles/globals.css";
```

2. In `src/styles/globals.css`, **keep**:
   - Font family declarations (`--font-sans`, `--font-mono`, `--font-heading`)
   - `@tailwindcss` + `tw-animate-css` imports
   - Sidebar tokens (`--sidebar-*`)
   - Chart tokens (`--chart-*`)
   - `@utility` blocks (`glow-indigo`, `border-glow`, `glass`, `text-gradient`)
   - `@layer base` styles

3. **Remove** from `globals.css`:
   - `:root { --background: ... }` through `--radius` — facet-tokens' `tokens.css`
     provides these (same OKLCH values, same variable names — verified).

**Design token conflict note**: arc-id uses indigo (`oklch(0.58 0.23 273)`) as its
primary. facet-tokens uses Electric Cyan (`#4AD3F5` / `oklch(0.78 0.18 200)`) per
the Alpha Palette. Decide which wins — override `--primary` in globals.css after
the facet-tokens import, or adopt the Alpha Palette across arc-id.

---

### Phase 3 — Replace `src/components/ui/` with `@arcevo/facet-components`

Mechanical find-and-replace. The components share the same Radix primitives,
named exports, and props.

```diff
- import { Button } from "@/components/ui/button";
+ import { Button } from "@arcevo/facet-components";
```

facet-components uses `cn()` internally from `tailwind-merge` + `clsx`.
arc-id's own `@/lib/utils` still exists for consumer-side usage — no conflict.

**After phase 3 is green, DELETE `src/components/ui/`.**

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
| `pnpm test` | All 395 tests passing |
| `pnpm dev:all` | Manual smoke test: login, register, MFA, tenant switch, passkey |
| Facet docs match | Compare facet's docs gallery against rendered components in arc-id |
| CSS regression | Sidebar, Topbar, TenantSwitcher, and pages render with correct colors |

---

_Guide updated 2026-08-04 for the published `@arcevo/facet-*` packages
(previously tracked arc-ui). Update it if any facet package API changes._
