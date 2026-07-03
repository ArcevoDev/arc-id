import { z } from "zod";
import { AuditLogAction } from "@/prisma-client";

// ─── Query Schemas ────────────────────────────────────────────────────────────

export const AuditQuerySchema = z.object({
  identityId: z.string().cuid().optional(),
  tenantId: z.string().optional(),
  /**
   * Filter by action type. Enum sourced from DB — new actions only require
   * a Prisma migration, not a validator update.
   */
  action: z.nativeEnum(AuditLogAction).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Output DTOs ─────────────────────────────────────────────────────────────

export const AuditLogDtoSchema = z.object({
  id: z.string().cuid(),
  action: z.nativeEnum(AuditLogAction),
  identityId: z.string().nullable(),
  tenantId: z.string().nullable(),
  ip: z.string().nullable(),
  metadata: z.any().nullable(),
  createdAt: z.coerce.string(),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type AuditQuery = z.infer<typeof AuditQuerySchema>;
export type AuditLogDto = z.infer<typeof AuditLogDtoSchema>;
