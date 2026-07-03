// src/modules/auth/flows/mfa-setup.flow.ts
import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
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
    if (!ctx.identityId) throw ApiError.unauthorized();

    const identity = await ctx.db.identity.findUniqueOrThrow({
      where: { id: ctx.identityId },
    });

    const mfaService = new MfaService(ctx.db);
    const { secret, uri, qrCode } = await mfaService.setupTotp(
      ctx.identityId,
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
    if (!ctx.identityId) throw ApiError.unauthorized();

    const mfaService = new MfaService(ctx.db);
    const confirmed = await mfaService.confirmTotp(ctx.identityId, input.code);
    if (!confirmed)
      throw ApiError.badRequest("Invalid TOTP code — confirm failed");

    const recoveryCodes = await mfaService.generateRecoveryCodes(
      ctx.identityId,
    );

    const identity = await ctx.db.identity.findUnique({
      where: { id: ctx.identityId },
      select: { primaryEmail: true, name: true },
    });

    if (identity?.primaryEmail) {
      void notificationService.sendRecoveryCodes(
        identity.primaryEmail,
        recoveryCodes,
        identity.name ?? undefined,
      );
    }

    await auditService.log(
      { action: "MFA_ENABLED", identityId: ctx.identityId },
      ctx.db,
    );

    return { recoveryCodes };
  },
};

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

  await auditService.log({ action: "MFA_DISABLED", identityId }, db);
}
