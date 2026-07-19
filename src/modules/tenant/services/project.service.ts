// src/modules/tenant/services/project.service.ts
//
// NEW MODULE. Mirrors the structure of TenantService — assertMembership-style
// guard, then thin CRUD wrappers. Kept deliberately small: Project has no
// independent RBAC of its own (a tenant ADMIN administers all Projects under
// their tenant; there is no per-project role today). If that's ever needed,
// it's a TenantMembership-style join table on Project — not a reason to
// promote Project to a Tenant by itself.

import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors";
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from "../validators/project.schemas";

export class ProjectService {
  constructor(private readonly db: DbClient) {}

  /** Re-uses the same membership check pattern as TenantService.assertMembership. */
  async assertMembership(tenantId: string, identityId: string): Promise<void> {
    const membership = await this.db.tenantMembership.findFirst({
      where: { identityId, tenantId, status: "ACTIVE" },
      select: { id: true },
    });

    if (!membership) {
      throw ApiError.forbidden("You are not a member of this tenant");
    }
  }

  async create(tenantId: string, input: CreateProjectInput) {
    const existing = await this.db.project.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.badRequest(
        `Project slug '${input.slug}' is already in use`,
      );
    }

    return this.db.project.create({
      data: {
        tenantId,
        name: input.name,
        slug: input.slug,
        category: input.category ?? null,
      },
    });
  }

  async list(tenantId: string, category?: string) {
    return this.db.project.findMany({
      where: {
        tenantId,
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { clients: true, onboardingFlows: true } },
      },
    });
  }

  async getById(tenantId: string, projectId: string) {
    const project = await this.db.project.findFirst({
      where: { id: projectId, tenantId },
      include: {
        clients: {
          select: {
            id: true,
            clientId: true,
            name: true,
            public: true,
            createdAt: true,
          },
        },
        onboardingFlows: {
          select: { id: true, name: true, isActive: true, createdAt: true },
        },
      },
    });
    if (!project) throw ApiError.notFound("Project not found");
    return project;
  }

  async update(tenantId: string, projectId: string, input: UpdateProjectInput) {
    const existing = await this.db.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    });
    if (!existing) throw ApiError.notFound("Project not found");

    return this.db.project.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
      },
    });
  }

  /**
   * Deleting a Project cascades to OnboardingFlow/OnboardingProgress
   * (Prisma onDelete: Cascade on that relation) but NOT to Client —
   * Client.projectId uses onDelete: SetNull, so OAuth clients survive
   * and fall back to tenant-level, since live tokens may depend on them.
   */
  async delete(tenantId: string, projectId: string) {
    const existing = await this.db.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    });
    if (!existing) throw ApiError.notFound("Project not found");

    await this.db.project.delete({ where: { id: projectId } });
  }
}
