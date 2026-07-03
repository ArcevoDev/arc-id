// src/modules/billing/flows/upgrade-plan.flow.ts
import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { UpgradePlanSchema } from "../validators/billing.schemas";
import { SubscriptionService } from "../services/subscription.service";
import { ApiError } from "@/core/errors";

export const upgradePlanFlow: Flow<z.infer<typeof UpgradePlanSchema>> = {
  name: "billing:upgrade-plan",
  inputSchema: UpgradePlanSchema,

  async execute(input, ctx: FlowContext) {
    if (!ctx.identityId) throw ApiError.unauthorized();

    // Subscription is TENANT-scoped — upgrade the calling user's active tenant
    // Default to SYSTEM if no tenant context (free-tier users)
    const tenantId = ctx.tenantId ?? "SYSTEM";

    // Only ADMIN members can upgrade a tenant's plan
    const membership = await ctx.db.tenantMembership.findFirst({
      where: { identityId: ctx.identityId, tenantId, status: "ACTIVE" },
      include: { role: { select: { name: true } } },
    });

    if (!membership) {
      throw ApiError.forbidden("You are not a member of this tenant");
    }

    // Allow any member to "upgrade" the SYSTEM tenant (for personal plan tracking)
    // Only ADMIN can upgrade org tenants
    if (tenantId !== "SYSTEM" && membership.role.name !== "ADMIN") {
      throw ApiError.forbidden(
        "Only tenant ADMINs can change the subscription plan",
      );
    }

    const subscriptionService = new SubscriptionService(ctx.db);
    const subscription = await subscriptionService.upgrade(
      tenantId,
      input.plan,
    );

    return { subscription };
  },
};
