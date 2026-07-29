#!/bin/sh
# ── docker-entrypoint.sh ──────────────────────────────────────────────────────
# Runs Prisma migrations on every start, then exec's the container CMD.
#
# WHY THIS PATTERN:
#   `prisma migrate deploy` is idempotent — it only applies pending migrations
#   that haven't been recorded in the _prisma_migrations table. Running it on
#   every container start is safe and ensures the schema is always up-to-date,
#   even after a rollback or a fresh database volume.
#
# PRECAUTION:
#   If the database is unreachable (e.g. migration fails), the container exits
#   immediately instead of starting a server with a stale schema. Docker
#   Compose's `restart: unless-stopped` will retry automatically once the
#   database is healthy.

set -e

echo "[ENTRYPOINT] Running Prisma migrations..."
npx prisma migrate deploy --schema=prisma/schema.prisma
echo "[ENTRYPOINT] Migrations applied successfully."

echo "[ENTRYPOINT] Starting: $*"
exec "$@"
