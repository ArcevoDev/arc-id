// src/core/db/prisma.ts
//
// CHANGE: The exported `prisma` singleton is now wrapped with
// withTenantIsolation(). Every route and flow that uses ctx.db (which is
// this singleton, or a $transaction derived from it) automatically gets the
// tenant write guard — no per-route changes needed.
//
// The raw PrismaClient (before the extension) is NOT exported. If you
// genuinely need to bypass isolation (seeding, migrations, sys-admin scripts
// that run outside the HTTP server), instantiate a new PrismaClient directly
// in that script rather than importing from here.

import { PrismaClient } from "@prisma-client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "@/core/config";
import { withTenantIsolation } from "./tenant-isolation";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof withTenantIsolation<PrismaClient>> | undefined;
};

function buildPool(max: number) {
  return new Pool({
    connectionString: config.db.url,
    max,
    idleTimeoutMillis: 30000,
  });
}

function buildClient(pool: Pool) {
  const adapter = new PrismaPg(pool);
  const base = new PrismaClient({
    adapter,
    ...(config.base.env !== "production" && {
      log: ["query", "error", "warn"],
    }),
  });
  return withTenantIsolation(base);
}

let prismaInstance: ReturnType<typeof withTenantIsolation<PrismaClient>>;

if (config.base.env === "production") {
  prismaInstance = buildClient(buildPool(20));
} else {
  // Prevent hot-reload from exhausting connection pool limits in dev
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = buildClient(buildPool(10));
  }
  prismaInstance = globalForPrisma.prisma;
}

export const prisma = prismaInstance;
