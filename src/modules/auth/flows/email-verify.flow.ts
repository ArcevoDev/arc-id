import { z } from "zod";
import type { FlowContext, Flow } from "@/core/flows";
import { EmailVerifySchema } from "../validators/auth.schemas";
import { EmailTokenService } from "../services/email-token.service";
import { notificationService } from "@/lib/notifications/notification.service";

export const emailVerifyFlow: Flow<z.infer<typeof EmailVerifySchema>> = {
  name: "auth:email-verify",
  inputSchema: EmailVerifySchema,

  async execute(input, ctx: FlowContext) {
    const emailTokenService = new EmailTokenService(ctx.db);
    const tokenRecord = await emailTokenService.consume(
      input.token,
      "VERIFY_EMAIL",
    );

    const identity = await ctx.db.identity.update({
      where: { id: tokenRecord.identityId },
      data: { emailVerified: true, status: "ACTIVE" },
      select: { primaryEmail: true, name: true },
    });

    // Fire welcome email now that the account is truly active
    if (identity.primaryEmail) {
      void notificationService.sendWelcome(identity.primaryEmail, {
        name: identity.name ?? undefined,
      });
    }

    return {};
  },
};
