// src/modules/identity/flows/delete-account.flow.ts
import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { notificationService } from "@/lib/notifications/notification.service";

export const deleteAccountFlow: Flow<Record<string, never>> = {
  name: "identity:delete-account",
  inputSchema: z.object({}),

  async execute(_input, ctx: FlowContext) {
    if (!ctx.userId) throw ApiError.unauthorized();

    const identity = await ctx.db.identity.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { primaryEmail: true, name: true },
    });

    // Soft-delete: mark as DELETED, revoke all sessions
    await ctx.db.identity.update({
      where: { id: ctx.userId },
      data: { status: "DELETED" },
    });

    await ctx.db.session.updateMany({
      where: { identityId: ctx.userId, valid: true },
      data: { valid: false },
    });

    await ctx.db.refreshToken.updateMany({
      where: { identityId: ctx.userId, revoked: false },
      data: { revoked: true },
    });

    auditService.log({
      action: "IDENTITY_DELETED",
      identityId: ctx.userId,
      ip: ctx.ip,
    });

    if (identity.primaryEmail) {
      void notificationService.sendAccountDeletion(identity.primaryEmail, {
        name: identity.name ?? undefined,
        graceDays: 30,
      });
    }

    return {};
  },
};
