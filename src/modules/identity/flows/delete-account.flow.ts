import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { notificationService } from "@/lib/notifications/notification.service";

export const deleteAccountFlow: Flow<
  Record<string, never>,
  Record<string, never>
> = {
  name: "identity:delete-account",
  inputSchema: z.object({}),

  async execute(_input, ctx: FlowContext): Promise<Record<string, never>> {
    if (!ctx.identityId) throw ApiError.unauthorized("Authentication required");

    const identity = await ctx.db.identity.findUniqueOrThrow({
      where: { id: ctx.identityId },
      select: { primaryEmail: true, name: true },
    });

    await ctx.db.$transaction([
      ctx.db.identity.update({
        where: { id: ctx.identityId },
        data: { status: "DELETED" },
      }),
      ctx.db.session.updateMany({
        where: { identityId: ctx.identityId, valid: true },
        data: { valid: false },
      }),
      ctx.db.refreshToken.updateMany({
        where: { identityId: ctx.identityId, revoked: false },
        data: { revoked: true },
      }),
      ctx.db.accessToken.updateMany({
        where: { identityId: ctx.identityId, revoked: false },
        data: { revoked: true },
      }),
    ]);

    await auditService.log({
      action: "IDENTITY_DELETED",
      identityId: ctx.identityId,
      ip: ctx.ip ?? "0.0.0.0",
    });

    if (identity.primaryEmail) {
      notificationService
        .sendAccountDeletion(identity.primaryEmail, {
          name: identity.name ?? undefined,
          graceDays: 30,
        })
        .catch((err) => {
          // Rearranged parameters to guarantee error and message logging compile safely
          ctx.logger?.error(
            "Deferred account deletion notification failed",
            err,
          );
        });
    }

    return {};
  },
};
