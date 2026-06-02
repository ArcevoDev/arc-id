import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { MfaService } from "../services/mfa.service";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { notificationService } from "@/lib/notifications/notification.service";

const MfaSetupSchema = z.object({
  type: z.literal("TOTP"),
});

const MfaConfirmSchema = z.object({
  code: z.string().length(6),
});

export const mfaSetupFlow: Flow<
  z.infer<typeof MfaSetupSchema>,
  { uri: string; secret: string; qrCode: string }
> = {
  name: "auth:mfa-setup",
  inputSchema: MfaSetupSchema,

  async execute(input, ctx: FlowContext) {
    if (!ctx.userId) throw ApiError.unauthorized();

    const identity = await ctx.db.identity.findUniqueOrThrow({
      where: { id: ctx.userId },
    });

    const mfaService = new MfaService(ctx.db);
    const { secret, uri, qrCode } = await mfaService.setupTotp(
      ctx.userId,
      identity.primaryEmail ?? "",
    );

    return { secret, uri, qrCode };
  },
};

export const mfaConfirmFlow: Flow<
  z.infer<typeof MfaConfirmSchema>,
  { recoveryCodes: string[] }
> = {
  name: "auth:mfa-confirm",
  inputSchema: MfaConfirmSchema,

  async execute(input, ctx: FlowContext) {
    if (!ctx.userId) throw ApiError.unauthorized();

    const mfaService = new MfaService(ctx.db);
    const confirmed = await mfaService.confirmTotp(ctx.userId, input.code);
    if (!confirmed)
      throw ApiError.badRequest("Invalid TOTP code — confirm failed");

    const recoveryCodes = await mfaService.generateRecoveryCodes(ctx.userId);

    const identity = await ctx.db.identity.findUnique({
      where: { id: ctx.userId },
      select: { primaryEmail: true, name: true },
    });

    if (identity?.primaryEmail) {
      void notificationService.sendRecoveryCodes(
        identity.primaryEmail,
        recoveryCodes,
        identity.name ?? undefined,
      );
    }

    auditService.log({ action: "MFA_ENABLED", identityId: ctx.userId });

    return { recoveryCodes };
  },
};

// Called from mfa.route.ts DELETE /mfa
export async function disableMfa(
  identityId: string,
  db: FlowContext["db"],
  ip?: string,
) {
  await db.mfa.updateMany({
    where: { identityId },
    data: { enabled: false },
  });

  const identity = await db.identity.findUnique({
    where: { id: identityId },
    select: { primaryEmail: true, name: true },
  });

  if (identity?.primaryEmail) {
    void notificationService.sendMfaDisabledAlert(identity.primaryEmail, {
      name: identity.name ?? undefined,
      ip,
    });
  }

  auditService.log({ action: "MFA_DISABLED", identityId });
}
