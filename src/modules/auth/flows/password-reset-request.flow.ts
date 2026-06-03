// src/modules/auth/flows/password-reset-request.flow.ts
import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { PasswordResetRequestSchema } from "../validators/auth.schemas";
import { EmailTokenService } from "../services/email-token.service";
import { notificationService } from "@/lib/notifications/notification.service";

export const passwordResetRequestFlow: Flow<z.infer<typeof PasswordResetRequestSchema>, Record<string, never>> = {
  name: "auth:password-reset-request",
  inputSchema: PasswordResetRequestSchema,

  async execute(input, ctx: FlowContext): Promise<Record<string, never>> {
    const identity = await ctx.db.identity.findUnique({
      where: { primaryEmail: input.email },
      select: { id: true, primaryEmail: true, name: true },
    });

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