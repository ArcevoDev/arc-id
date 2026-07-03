import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { prisma } from "@/core/db";

declare module "fastify" {
  interface FastifyInstance {
    db: typeof prisma;
  }
}

/**
 * Decorates fastify.db with the Prisma client singleton.
 * Disconnects gracefully on server close.
 */
export const dbPlugin = fp(
  async (fastify: FastifyInstance) => {
    fastify.decorate("db", prisma);
    fastify.addHook("onClose", async () => {
      await prisma.$disconnect();
    });
  },
  { name: "arc-id:db" },
);
