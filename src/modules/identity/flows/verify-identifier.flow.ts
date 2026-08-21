// src/modules/identity/flows/verify-identifier.flow.ts
//
// Challenge an external identifier for verification. Generates a secure
// 6-digit code, stores it transiently on the ExternalIdentifier record,
// and sends it to the displayValue (email via Resend, or SMS via Brevo).
// The companion confirm flow validates the code and flips verified=true.

import { randomInt } from "crypto";
import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";
import { notificationService } from "@/lib/notifications/notification.service";
import { VerifyExternalIdSchema } from "../validators/external-id.schemas";

type Input = z.infer<typeof VerifyExternalIdSchema>;

interface Output {
  success: boolean;
  type: string;
}

const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const verifyExternalIdentifierFlow: Flow<Input, Output> = {
  name: "identity:verify-external-identifier",
  inputSchema: VerifyExternalIdSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    if (!ctx.identityId) {
      throw ApiError.unauthorized("Authenticated identity required");
    }

    // Fetch the external identifier scoped to the requesting identity.
    const record = await ctx.db.externalIdentifier.findFirst({
      where: {
        id: input.id,
        identityId: ctx.identityId,
      },
      select: {
        id: true,
        type: true,
        displayValue: true,
        verified: true,
      },
    });

    if (!record) {
      throw ApiError.notFound("External identifier not found");
    }

    if (record.verified) {
      throw ApiError.badRequest("External identifier is already verified");
    }

    // Only email and phone support automatic code-based verification.
    if (record.type !== "email" && record.type !== "phone") {
      throw ApiError.badRequest(
        "Verification is only supported for email and phone identifiers",
      );
    }

    // Generate a cryptographically secure 6-digit code.
    const code = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    // Store the code transiently on the record.
    await ctx.db.externalIdentifier.update({
      where: { id: input.id },
      data: {
        verificationCode: code,
        verificationExpiresAt: expiresAt,
      },
    });

    // Deliver the code.
    if (record.type === "email" && record.displayValue) {
      await notificationService.sendMfaCode(record.displayValue, code, {
        ttlSec: VERIFICATION_CODE_TTL_MS / 1000,
      });
    } else if (record.type === "phone" && record.displayValue) {
      notificationService.sendMfaCodeSms(record.displayValue, code);
    } else {
      throw ApiError.badRequest(
        "No contact value available for verification code delivery",
      );
    }

    // Audit (fire-and-forget).
    void auditService
      .log({
        action: "EXTERNAL_IDENTIFIER_VERIFICATION_SENT",
        identityId: ctx.identityId,
        tenantId: ctx.tenantId ?? undefined,
        ip: ctx.ip,
        metadata: { type: record.type },
        requestId: ctx.requestId,
      })
      .catch(() => {});

    return { success: true, type: record.type };
  },
};
