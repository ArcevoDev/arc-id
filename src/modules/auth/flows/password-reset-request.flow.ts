import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { PasswordResetRequestSchema } from "../validators/auth.schemas";
import { EmailTokenService } from "../services/email-token.service";
import { notificationService } from "@/lib/notifications/notification.service";

export const passwordResetRequestFlow: Flow<
  z.infer<typeof PasswordResetRequestSchema>
> = {
  name: "auth:password-reset-request",
  inputSchema: PasswordResetRequestSchema,

  async execute(input, ctx: FlowContext) {
    const identity = await ctx.db.identity.findUnique({
      where: { primaryEmail: input.email },
      select: { id: true, primaryEmail: true, name: true },
    });

    // Always return success — never leak whether email exists
    if (!identity?.primaryEmail) return {};

    const emailTokenService = new EmailTokenService(ctx.db);
    const token = await emailTokenService.issue(identity.id, "RESET_PASSWORD");

    void notificationService.sendPasswordReset(identity.primaryEmail, token, {
      name: identity.name ?? undefined,
      ip: ctx.ip,
    });

    return {};
  },
};
