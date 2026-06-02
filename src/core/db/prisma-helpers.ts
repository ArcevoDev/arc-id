import { Prisma } from "@/prisma-client";
import { prisma } from "./prisma";
import { ApiError } from "@/core/errors/api-error";

export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  return prisma.$transaction(fn, {
    timeout: options?.timeout ?? 10_000,
    maxWait: options?.maxWait ?? 5_000,
  });
}

export async function assertUnique<T>(
  finder: () => Promise<T | null>,
  message: string,
): Promise<void> {
  const existing = await finder();
  if (existing) throw ApiError.conflict(message);
}

export async function assertExists<T>(
  finder: () => Promise<T | null>,
  message: string,
): Promise<T> {
  const record = await finder();
  if (!record) throw ApiError.notFound(message);
  return record;
}

export async function softDelete<T extends { id: string }>(
  model: { update: (args: any) => Promise<T> },
  id: string,
): Promise<T> {
  return model.update({ where: { id }, data: { status: "DELETED" } });
}
