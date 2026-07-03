# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

> Seeded manually on 2026-07-03 from established, already-enforced
> conventions in `AGENTS.md` / `CLAUDE.md`, so Command Code starts at high
> confidence instead of re-deriving these from scratch over the first dozen
> sessions. Confidence will keep updating from real accept/reject/edit
> signals from here — this seed is a floor, not a ceiling.

## Tooling
- Use pnpm as package manager. Confidence: 0.95
- ESM only — never emit `require()` / `module.exports`. Confidence: 0.95
- Vitest for tests, never Jest. Confidence: 0.95
- Zod for all runtime validation (`.schemas.ts` files). Confidence: 0.9

## Backend architecture
- All business logic goes in a `Flow` object under `src/modules/<name>/flows/`,
  never inline in a route handler. Confidence: 0.95
- Throw `ApiError.<helper>()` static methods only — never `throw new Error()`
  or a raw object. Confidence: 0.95
- Inside a flow, database access is always `ctx.db`, never a direct
  `prisma` import. Confidence: 0.9
- Always project Prisma queries with `select` — avoid fetching full rows
  for a couple of fields. Confidence: 0.85
- New DB schema changes go through `pnpm prisma:migrate` — never hand-edit
  a migration file, especially not one already applied. Confidence: 0.95
- Route protection is declared via `preHandler: fastify.auth.requireX`
  helpers, not manual token/role checks inline in the handler. Confidence: 0.9

## Frontend architecture
- Components never call the API directly — always
  component → hook (`use-*.ts`) → Zustand store → SDK (`src/sdk/*.sdk.ts`).
  Confidence: 0.9
- Styling: Tailwind + shadcn/ui (`new-york` style), dark-first design tokens
  in `src/styles/globals.css` — don't introduce a second styling system.
  Confidence: 0.85

## Naming
- `<name>.flow.ts`, `<name>.route.ts`, `<name>.service.ts`,
  `<name>.repository.ts`, `<name>.schemas.ts`, `<name>.presenter.ts`,
  `<name>.test.ts` (co-located), `use-<name>.ts`, `<name>.store.ts`,
  `<name>.sdk.ts`. Confidence: 0.9

## Security
- Any outbound fetch to a user-supplied URL must go through
  `assertSafeUrl()` first — no inline `fetch()` on raw user input.
  Confidence: 0.9
- Never hardcode a signing/verification algorithm — always read it from the
  key record or JWT header. Confidence: 0.85