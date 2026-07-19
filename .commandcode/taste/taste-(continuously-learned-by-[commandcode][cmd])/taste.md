# Taste (Continuously Learned by [CommandCode][cmd])

- Use pnpm as package manager. Confidence: 0.95
- ESM only — never emit `require()` / `module.exports`. Confidence: 0.95
- Vitest for tests, never Jest. Confidence: 0.95
- Zod for all runtime validation (`.schemas.ts` files). Confidence: 0.9
- After any code change, run `pnpm typecheck` (tsc) AND `pnpm test` (vitest) — don't rely on vitest alone, as it can miss type errors that tsc catches. Confidence: 0.80
- For multi-site migrations (e.g., replacing authorization patterns across the codebase): replace call sites one module at a time, testing after each module, rather than making all changes then testing in one pass. Confidence: 0.75
- Never create manual hand-written Prisma migrations — use `prisma migrate diff` or `prisma migrate dev` to generate SQL from schema changes. Confidence: 0.70
- Show generated Prisma migration SQL to the user before applying it. Confidence: 0.65
- Avoid broad process-killing commands like taskkill. Confidence: 0.65
