import { PrismaClient } from "@/prisma-client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "@/core/config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

if (config.base.env === "production") {
  const pool = new Pool({
    connectionString: config.db.url,
    max: 20,
    idleTimeoutMillis: 30000,
  });
  const adapter = new PrismaPg(pool);
  prismaInstance = new PrismaClient({ adapter });
} else {
  // Prevent hot-reloading from breaking local developer pool limits
  if (!globalForPrisma.prisma) {
    const pool = new Pool({
      connectionString: config.db.url,
      max: 10,
      idleTimeoutMillis: 15000,
    });
    const adapter = new PrismaPg(pool);
    globalForPrisma.prisma = ClientWithLogging(adapter);
  }
  prismaInstance = globalForPrisma.prisma;
}

function ClientWithLogging(adapter: PrismaPg): PrismaClient {
  return new PrismaClient({
    adapter,
    log: ["query", "error", "warn"],
  });
}

export const prisma = prismaInstance;
