import { prisma } from "@/core/db/prisma";
import { Prisma } from "@/prisma-client";

// This represents the union of standard and transactional clients
export type DbClient = Prisma.TransactionClient | typeof prisma;

// Export the base client explicitly for "Outside Transaction" tasks
export const db = prisma;
