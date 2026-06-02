import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { UpgradePlanSchema } from "../validators/billing.schemas";
import { SubscriptionService } from "../services/subscription.service";
import { ApiError } from "@/core/errors/api-error";

export const upgradePlanFlow: Flow<z.infer<typeof UpgradePlanSchema>> = {
  name: "billing:upgrade-plan",
  inputSchema: UpgradePlanSchema,

  async execute(input, ctx: FlowContext) {
    if (!ctx.userId) throw ApiError.unauthorized();
    const subscriptionService = new SubscriptionService(ctx.db);
    const subscription = await subscriptionService.upgrade(
      ctx.userId,
      input.plan,
    );
    return { subscription };
  },
};
