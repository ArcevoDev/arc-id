# ── Stage 1: Install ALL dependencies ─────────────────────────────────────────
# We install everything here (deps + devDeps) because:
#   a) tsup marks every dependency as "external", so the build output is just
#      compiled JS - node_modules must exist at runtime.
#   b) Prisma CLI (devDep) is needed for `prisma generate` and `prisma migrate deploy`.
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Hooks aren't available in CI/Docker, and `prepare` tries to install git hooks.
ENV HUSKY=0

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
# .dockerignore excludes node_modules/, so only source files are copied.
# node_modules is inherited from the deps stage via FROM.
COPY . .

RUN pnpm prisma:generate
RUN pnpm build:api

# ── Stage 3: Runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

ENV HUSKY=0
ENV NODE_ENV=production

# Copy built artifacts and runtime dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/certs ./certs

# By default, start the HTTP server. Override CMD for workers.
EXPOSE 4000

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/start-server.js"]
