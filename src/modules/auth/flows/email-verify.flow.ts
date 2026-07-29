// src/modules/auth/flows/email-verify.flow.ts
import { z } from "zod";
import type { FlowContext, Flow } from "@/core/flows";
import { EmailVerifySchema } from "../validators/auth.schemas";
import { EmailTokenService } from "../services/email-token.service";
import { notificationService } from "@/lib/notifications/notification.service";
import { auditService } from "@/modules/audit/services/audit.service";

export const emailVerifyFlow: Flow<
  z.infer<typeof EmailVerifySchema>,
  Record<string, never>
> = {
  name: "auth:email-verify",
  inputSchema: EmailVerifySchema,

  async execute(input, ctx: FlowContext): Promise<Record<string, never>> {
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

    if (identity.primaryEmail) {
      void notificationService.sendWelcome(identity.primaryEmail, {
        name: identity.name ?? undefined,
      });
    }

    await auditService.log(
      {
        action: "EMAIL_VERIFIED",
        identityId: tokenRecord.identityId,
        ip: ctx.ip,
        requestId: ctx.requestId,
      },
      ctx.db,
    );

    return {};
  },
};
