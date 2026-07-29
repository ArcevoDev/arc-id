# arc-id → arc-ui Migration Guide

> **Target**: Replace arc-id's in-repo shadcn/ui components, auth UI, and SDK
> client with the standalone `@arc-ui/*` packages.
>
> **Status**: arc-ui is 100% built and type-checked. This guide is the execution
> plan. See `docs/planning/arcid-v1-roadmap.md` for overall project state.

---

## Overview

arc-id currently duplicates three things that arc-ui now owns from a single
source of truth:

| Duplicated in arc-id | Replaced by | Files affected |
|---|---|---|
| `src/components/ui/*` (25 shadcn components) | `@arc-ui/components` | ~25 files |
| `src/components/auth/*` (LoginForm, RegisterForm, etc.) | `@arc-ui/auth` | ~6 files |
| `src/sdk/*` (client + 10 domain SDKs, ~102 methods) | `@arc-ui/sdk` | ~13 files |

**What arc-id keeps**: layout components (`src/components/layout/`), pages
(`src/app/`), Zustand stores (`src/store/`), hooks (`src/hooks/`), nav config,
providers, and CSS custom utilities.

---

## Migration Order

Each phase is reversible within a single commit — you can always revert.
Do them in order, testing after each phase.

---

### Phase 1 — Add `@arc-ui/*` as workspace dependencies

```sh
pnpm add @arc-ui/sdk @arc-ui/auth @arc-ui/components @arc-ui/tokens
```

If arc-ui is not yet published to npm, add it as a local workspace dependency:

```json
// package.json
{
  "dependencies": {
    "@arc-ui/sdk": "workspace:*",
    "@arc-ui/auth": "workspace:*",
    "@arc-ui/components": "workspace:*",
    "@arc-ui/tokens": "workspace:*"
  }
}
```

---

### Phase 2 — Replace CSS variables

1. Import arc-ui's tokens BEFORE the existing globals.css:

```ts
// src/app/layout.tsx — at the top of imports
import "@arc-ui/tokens/tokens.css";
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
   - `:root { --background: ... }` through `--radius` — arc-ui's `tokens.css`
     provides these. If arc-ui's defaults don't match the exact OKLCH values,
     override them in globals.css AFTER the arc-ui import.

**Design token conflict note**: arc-id uses indigo (`oklch(0.58 0.23 273)`) as its
primary. arc-ui uses Electric Cyan (`#4AD3F5` / `oklch(0.78 0.18 200)`) per the
Alpha Palette. You need to decide which one wins — either override `--primary`
in globals.css after the arc-ui import, or adopt the Alpha Palette across arc-id.

---

### Phase 3 — Replace `src/sdk/` with `@arc-ui/sdk`

This is the most mechanical change. arc-id's SDK uses factory functions
wired to Zustand (`createAuthSdk(client)`, `createTenantSdk(client)`, etc.).
arc-ui's SDK uses classes (`new AuthSdk(client)`).

**Keep** the `src/sdk/client.ts` token-refresh logic and the Zustand-wired
singleton in `src/sdk/index.ts`. Those are arc-id-specific orchestration
layers that belong in arc-id.

**Replace** the domain SDKs themselves. Each `create*Sdk(client)` factory
in `src/sdk/` can be swapped for `new *Sdk(client)` from `@arc-ui/sdk`:

```diff
- import { createAuthSdk } from "./auth.sdk";
+ import { AuthSdk } from "@arc-ui/sdk";
- const authSdk = createAuthSdk(client);
+ const authSdk = new AuthSdk(client);
```

The arc-ui SDK uses a slightly different response shape:

| | arc-id SDK | arc-ui SDK |
|---|---|---|
| Response type | `{ data: T, error: null } \| { data: null, error: ApiError }` | Same — compatible |
| Method signatures | `auth.login(email, password)` | `authSdk.login(email, password)` — same |
| Error type | `{ statusCode, error, message }` | `{ statusCode, error, message }` — same |

**After phase 3 is green, DELETE `src/sdk/*.sdk.ts`** (keep only `client.ts`
and `index.ts` as the orchestration layer).

---

### Phase 4 — Replace `src/components/ui/` with `@arc-ui/components`

Mechanical find-and-replace. The components have the same Radix primitives,
same named exports, same props.

```diff
- import { Button } from "@/components/ui/button";
+ import { Button } from "@arc-ui/components";
```

arc-ui uses `cn()` internally from `tailwind-merge` + `clsx`. arc-id's own
`@/lib/utils` still exists for consumer-side usage — no conflict.

**After phase 4 is green, DELETE `src/components/ui/`.**

---

### Phase 5 — Replace `src/components/auth/` with `@arc-ui/auth`

This is the most significant behavioral change. arc-id's auth components are
simple inline forms. arc-ui's use a state machine.

arc-id old → arc-ui new mapping:

| Old | New | Notes |
|---|---|---|
| `<LoginForm />` | `<SignIn config={eduPreset} />` | SignIn wraps method selection, MFA, passkey into one state machine |
| `<RegisterForm />` | `<SignUp />` | Direct replacement — same fields |
| `<MfaForm />` | `<MfaDialog />` | MfaDialog includes setup + confirm + recovery in one component |
| `<ForgotPasswordForm />` | `<ForgotPasswordForm />` | Also importable standalone from `@arc-ui/auth` |
| `auth/useAuth()` | `@arc-ui/auth`'s `useAuth()` | arc-id's returns Zustand-backed actions. arc-ui's returns provider-backed actions. |

**Critical architectural difference** — arc-id's auth is driven by Zustand
stores (`useAuthStore`). arc-ui's auth is driven by React context
(`ArcProvider`). You can run both side-by-side during migration:

```tsx
// During transition — ArcProvider manages UI state, Zustand persists tokens
<ArcProvider client={arcIdClient}>
  <OldAuthProvider>  {/* keep your Zustand hydration */}
    <App />
  </OldAuthProvider>
</ArcProvider>
```

The `ArcProvider` from @arc-ui/auth stores tokens via `TokenStorage`
(defaults to localStorage). arc-id's `useAuthStore` reads from localStorage
in its `AuthProvider`. They'll stay in sync as long as both read/write the
same localStorage keys.

**To fully unify**: make arc-id's `useAuthStore` the single source of truth
and pass a custom `TokenStorage` to ArcProvider that writes to the Zustand
store instead of localStorage.

---

### Phase 6 — Purge old files

After all phases are green across the full test suite:

```sh
git rm -r src/components/ui/
git rm -r src/components/auth/
# src/sdk/ — keep client.ts and index.ts, remove the individual .sdk.ts files
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
| `pnpm dev:all` | Manual smoke test: login, register, MFA, tenant switch |
| Storybook match | Compare arc-ui's stories against rendered components in arc-id |
| CSS regression | Sidebar, Topbar, TenantSwitcher, and pages render with correct colors |

---

_This guide was generated alongside the arc-ui monorepo (v0.1.0). Update it
if the arc-ui package API changes._
