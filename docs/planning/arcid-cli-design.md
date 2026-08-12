# ArcID CLI — Design & Onboarding Basis

> Status: **Planned** (per `arcid-v1-roadmap.md`: "CLI + SDK packages — after frontend
> rebuild stabilises API contract"). This doc is the initiated basis: the command
> surface, the consumer-wiring detection, the scaffold safety model, and how it
> reuses the facet CLI's shared command core. Code work starts once the API
> contract is stable.

---

## Why a CLI

ArcID is a Fastify + PostgreSQL (Prisma 7) identity engine. An integrator today
must: stand up a Postgres or we wire-up based on the db they run, agnostically..., run Prisma migrations - it all depends on their stack, and the most recommended is postgres..., copy env config, wire OAuth/OIDC
client settings, seed tenants + RBAC, and connect a frontend to the SDK. A CLI
turns that into one guided flow, detects what the integrator already has (DB
structure, existing auth, frontend stack), and scaffolds only what's missing —
without clobbering their work.

## Package shape

```
@arcevo/arcid-cli        (this repo, packages/cli, bin: "arcid")
  └── reuses @arcevo/facet-cli's published command core:
      lib/commands.ts     registry resolver, doctor report, update planner
      lib/types.ts        package-manager + monorepo/workspace detection
      lib/writer.ts       safe file writes (patch package.json, never clobber)
      lib/generators-plain.ts  add-component layout + barrel merge
```

The facet CLI already ships `pkg` / `doctor` / `update` and a docs scaffold. The
arcid CLI adds the identity-domain commands on top of that core rather than
reimplementing it.

## Command surface (planned)

### `arcid init` — wire ArcID into the consumer repo
- Detects the consumer's **DB structure**: reads `prisma/schema.prisma` /
  `schema.prisma` / a `DATABASE_URL`; classifies as Postgres-ready, needs
  migration, or missing.
- Detects **existing auth/id wiring**: `@arcevo/facet-auth` usage, existing OAuth
  client registrations, session/JWT setup, WebAuthn presence.
- Detects **frontend stack** (reuses facet CLI detection): Next, Remix, Vite,
  plain JS, Python.
- **Scaffolds a sample setup**: env template, Prisma schema patch (optional),
  seed script for tenants + RBAC, an OIDC client config, and a minimal
  `ArcIdClient` frontend wiring — *without overwriting* anything the consumer
  already has.
- **Safe overwrite / safe revert** (consumer's choice at each step):
  - Every file the CLI writes is recorded in a manifest
    (`.arcid/generated.json` with content hash + timestamp).
    - `arcid revert` restores the pre-scaffold state from that manifest.
  - Overwrites only happen with an explicit `--force` per file, and the prior
    content is preserved in `.arcid/backups/`.

### `arcid doctor` — audit an ArcID integration
- Reads the consumer's env, schema, and deps; reports: DB reachable/version,
  migrations applied vs pending, `@arcevo/facet-*` versions vs latest, auth
  surface wired (email/password, passkeys, OIDC), missing secrets, and
  best-practice suggestions (same shape as `facet doctor`).

### `arcid migrate` — generate + apply Prisma migrations
- Wraps `prisma migrate dev/deploy` with the ArcID schema as the source of
  truth, guarded by the same safe-overwrite model.

### `arcid setup <sdk|webhook|tenant>` — opinionated sub-scaffolds
- `arcid setup sdk` — generates the `ArcIdClient` + env wiring for a frontend.
- `arcid setup webhook` — registers a webhook endpoint + HMAC signing sample.
- `arcid setup tenant` — seeds a tenant + admin + RBAC role set.

### Inherited from facet core
- `arcid pkg` / `arcid update` — facet + arcid package version check/update.
- `arcid add <component>` — copy a facet component into source (shadcn-style).

## Detection details (DB / auth)

| Signal | Source | Meaning |
|--------|--------|---------|
| `prisma/schema.prisma` with `provider = "postgresql"` | file | Postgres-backed; compare model set against ArcID's required models |
| `DATABASE_URL` (or `POSTGRES_URL`) | `.env` | Connection present; try a `SELECT 1` probe |
| `@arcevo/facet-auth` in deps | package.json | Auth surface partially wired; skip redundant scaffolding |
| OAuth/OIDC env keys (`OIDC_ISSUER`, `JWKS_URL`, client id/secret) | `.env` | IdP integration present |
| `next`/`remix`/`vite`/`python` markers | deps + configs | Frontend stack for the SDK sample |

## Safe overwrite / revert contract

1. Before writing any file, check `.arcid/generated.json`; if the path is not
   registered and exists on disk, **skip** unless `--force`.
2. On `--force`, copy the existing file to `.arcid/backups/<relative-path>` first.
3. Record every write: `{ path, contentHash, timestamp, forced? }`.
4. `arcid revert` walks the manifest newest-first: delete generated files,
   restore backups. **Never** touches files it didn't create.

## Consumer docs (to ship alongside the CLI)

- `docs/arcid-cli/quickstart.md` — 5-minute install → `arcid init` → run.
- `docs/arcid-cli/doctor.md` — what `arcid doctor` checks and how to read it.
- `docs/arcid-cli/safe-scaffold.md` — the overwrite/revert model.
- `docs/arcid-cli/reference.md` — full flag reference + examples.
- Frontmatter link on every page to the hosted ArcID docs.

## Gating / sequencing

1. **Now**: this design doc is the basis (frontend rebuild still in flight).
2. After API contract stabilises: scaffold `packages/cli` in this repo, reuse
   `@arcevo/facet-cli` core, implement `init` → `doctor` → `migrate` → `setup`.
3. Then: `pkg`/`update`/`add` inheritance + hosted docs.
