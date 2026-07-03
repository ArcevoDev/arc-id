// src/modules/tenant/validators/project.schemas.ts
//
// NEW MODULE — Project did not have any validators, routes, services, or
// flows anywhere in the codebase prior to this. The Prisma model existed
// schema-only.
//
// Project = a product/section inside a Tenant (e.g. ArcID, ArcWallet,
// ArcVerify, Arcademy, ArcBase, the Cirqle landing page all live as Projects
// under the ArcevoCirqle tenant). `category` is an optional grouping label
// ("identity", "knowledge", etc) for organizing the console UI — it carries
// no isolation semantics; RBAC/billing/signing keys remain tenant-scoped.

import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  category: z.string().min(1).max(50).optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  category: z.string().min(1).max(50).nullable().optional(),
});

export const ProjectParamsSchema = z.object({
  tenantId: z.string().cuid(),
  projectId: z.string().cuid(),
});

export const TenantParamsSchema = z.object({
  tenantId: z.string().cuid(),
});

export const ListProjectsQuerySchema = z.object({
  category: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
