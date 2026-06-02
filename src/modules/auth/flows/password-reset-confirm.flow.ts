import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { PasswordResetConfirmSchema } from "../validators/auth.schemas";
import { EmailTokenService } from "../services/email-token.service";
import { hashPassword } from "../services/password.service";
import { SessionRepository } from "../repositories/session.repository";
import { notificationService } from "@/lib/notifications/notification.service";
import { auditService } from "@/modules/audit/services/audit.service";

export const passwordResetConfirmFlow: Flow<
  z.infer<typeof PasswordResetConfirmSchema>
> = {
  name: "auth:password-reset-confirm",
  inputSchema: PasswordResetConfirmSchema,

  async execute(input, ctx: FlowContext) {
    const emailTokenService = new EmailTokenService(ctx.db);
    const sessionRepo = new SessionRepository(ctx.db);

    const tokenRecord = await emailTokenService.consume(
      input.token,
      "RESET_PASSWORD",
    );
    const passwordHash = await hashPassword(input.newPassword);

    const localAccount = await ctx.db.localAccount.update({
      where: { identityId: tokenRecord.identityId },
      data: { passwordHash, passwordUpdatedAt: new Date() },
      include: { identity: { select: { primaryEmail: true, name: true } } },
    });

    await sessionRepo.revokeAllForIdentity(tokenRecord.identityId);

    if (localAccount.identity.primaryEmail) {
      void notificationService.sendPasswordChanged(
        localAccount.identity.primaryEmail,
        { name: localAccount.identity.name ?? undefined, ip: ctx.ip },
      );
    }

    auditService.log({
      action: "PASSWORD_CHANGED",
      identityId: tokenRecord.identityId,
      ip: ctx.ip,
    });

    return {};
  },
};
