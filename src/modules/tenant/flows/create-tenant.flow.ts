import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { CreateTenantSchema } from "../validators/tenant.schemas";
import { presentTenant } from "../presenters/tenant.presenter";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";

export const createTenantFlow: Flow<z.infer<typeof CreateTenantSchema>> = {
  name: "tenant:create",
  inputSchema: CreateTenantSchema,

  async execute(input, ctx: FlowContext) {
    if (!ctx.userId) throw ApiError.unauthorized();

    const slugTaken = await ctx.db.tenant.findFirst({
      where: { slug: input.slug },
    });
    if (slugTaken) throw ApiError.conflict("This slug is already taken");

    // Create tenant + default ADMIN role + policy + creator membership
    const tenant = await ctx.db.tenant.create({
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
          create: {
            name: "ADMIN",
            description: "Tenant administrator",
          },
        },
      },
      include: { roles: true },
    });

    // The ADMIN role was just created for this tenant
    const adminRole = tenant.roles.find((r) => r.name === "ADMIN");
    if (!adminRole) throw ApiError.internal("Failed to seed ADMIN role");

    // Create membership for the creator
    await ctx.db.tenantMembership.create({
      data: {
        identityId: ctx.userId,
        tenantId: tenant.id,
        roleId: adminRole.id,
        status: "ACTIVE",
      },
    });

    // Seed default member role as well for future invites
    await ctx.db.role.create({
      data: {
        tenantId: tenant.id,
        name: "MEMBER",
        description: "Standard tenant member",
      },
    });

    auditService.log({
      action: "TENANT_MEMBER_ADDED",
      identityId: ctx.userId,
      tenantId: tenant.id,
    });

    return { tenant: presentTenant(tenant) };
  },
};
