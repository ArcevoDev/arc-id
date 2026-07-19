// src/lib/db-client.ts
//
// CHANGE: DbClient now reflects the IsolatedPrismaClient type so that
// FlowContext.db and anywhere else DbClient is used carries the correct
// extended type rather than the bare PrismaClient.
//
// This is a type-only change — no runtime behaviour differs.
// The actual client is still the same singleton from src/core/db/prisma.ts.

import type { Prisma } from "@prisma-client";
import type { IsolatedPrismaClient } from "@/core/db";

/**
 * The type for the Prisma client used throughout the app.
 *
 * In production code (routes, flows, services): this is the isolated client
 * returned by withTenantIsolation().
 *
 * Inside $transaction callbacks: Prisma narrows the type to
 * Prisma.TransactionClient — which is a subset of DbClient. Both are
 * assignable here because the extension's query interceptor applies to
 * transaction clients too (Prisma propagates $extends through transactions).
 */
export type DbClient = IsolatedPrismaClient | Prisma.TransactionClient;
