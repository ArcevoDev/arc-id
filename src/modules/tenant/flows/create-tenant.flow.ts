// src/modules/tenant/flows/create-tenant.flow.ts
import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import type { IsolatedPrismaClient } from "@/core/db";
import { CreateTenantSchema } from "../validators/tenant.schemas";
import { presentTenant } from "../presenters/tenant.presenter";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";

export const createTenantFlow: Flow<z.infer<typeof CreateTenantSchema>> = {
  name: "tenant:create",
  inputSchema: CreateTenantSchema,

  async execute(input, ctx: FlowContext) {
    if (!ctx.identityId) throw ApiError.unauthorized();

    const slugTaken = await ctx.db.tenant.findFirst({
      where: { slug: input.slug },
    });
    if (slugTaken) throw ApiError.conflict("This slug is already taken");

    // Plan-based tenant cap enforcement
    const plan = ctx.plan ?? "FREE";
    const tenantCaps: Record<string, number> = {
      FREE: 1,
      PRO: 5,
      ENTERPRISE: Infinity,
    };
    const cap = tenantCaps[plan] ?? 1;
    const currentTenantCount = await ctx.db.tenantMembership.count({
      where: { identityId: ctx.identityId },
    });
    if (currentTenantCount >= cap) {
      const label = cap === 1 ? "tenant" : "tenants";
      throw new ApiError(
        `Your ${plan} plan allows up to ${cap} ${label}. Upgrade your plan to create more.`,
        400,
        "TENANT_CAP_REACHED",
      );
    }

    const tenant = await (ctx.db as unknown as IsolatedPrismaClient).$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          sector: input.sector,
          policies: {
            create: {
              requireMfa: false,
              loginMethods: ["email_password"],
            },
          },
          roles: {
            create: [
              {
                name: "ADMIN",
                description: "Tenant administrator",
              },
              {
                name: "MEMBER",
                description: "Standard tenant member",
              },
            ],
          },
        },
        include: { roles: true },
      });

      const adminRole = newTenant.roles.find((r) => r.name === "ADMIN");
      if (!adminRole) throw ApiError.internal("Failed to seed ADMIN role");

      await tx.tenantMembership.create({
        data: {
          identityId: ctx.identityId!,
          tenantId: newTenant.id,
          roleId: adminRole.id,
          status: "ACTIVE",
        },
      });

      return newTenant;
    });

    void auditService
      .log({
        action: "TENANT_CREATED",
        identityId: ctx.identityId,
        tenantId: tenant.id,
      })
      .catch(() => {});

    return { tenant: presentTenant(tenant) };
  },
};
