// src/modules/tenant/flows/create-tenant.flow.ts
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
    if (!ctx.identityId) throw ApiError.unauthorized();

    const slugTaken = await ctx.db.tenant.findFirst({
      where: { slug: input.slug },
    });
    if (slugTaken) throw ApiError.conflict("This slug is already taken");

    const tenant = await ((ctx.db as any).$transaction(async (tx: any) => {
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

      const adminRole = newTenant.roles.find((r: any) => r.name === "ADMIN");
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
    }) as Promise<any>);

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
