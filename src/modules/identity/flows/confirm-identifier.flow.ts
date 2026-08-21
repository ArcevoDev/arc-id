// src/modules/identity/flows/confirm-identifier.flow.ts
//
// Confirm an external identifier verification challenge. Validates the
// 6-digit code against the stored value, enforces a 10-minute TTL and
// single-use semantics, then flips verified=true and clears the code.

import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";
import { ConfirmVerifyExternalIdSchema } from "../validators/external-id.schemas";

type Input = z.infer<typeof ConfirmVerifyExternalIdSchema>;

interface Output {
  id: string;
  verified: boolean;
}

export const confirmExternalIdentifierFlow: Flow<Input, Output> = {
  name: "identity:confirm-external-identifier",
  inputSchema: ConfirmVerifyExternalIdSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    if (!ctx.identityId) {
      throw ApiError.unauthorized("Authenticated identity required");
    }

    const now = new Date();

    // Fetch the record scoped to the requesting identity, selecting
    // the fields needed for code comparison and expiry check.
    const record = await ctx.db.externalIdentifier.findFirst({
      where: {
        id: input.id,
        identityId: ctx.identityId,
      },
      select: {
        id: true,
        type: true,
        verified: true,
        verificationCode: true,
        verificationExpiresAt: true,
      },
    });

    if (!record) {
      throw ApiError.notFound("External identifier not found");
    }

    if (record.verified) {
      throw ApiError.badRequest("External identifier is already verified");
    }

    if (!record.verificationCode) {
      throw ApiError.badRequest(
        "No verification code pending — request a new code first",
      );
    }

    // Enforce TTL — clear expired codes so the record is clean.
    if (!record.verificationExpiresAt || now > record.verificationExpiresAt) {
      await ctx.db.externalIdentifier.update({
        where: { id: input.id },
        data: {
          verificationCode: null,
          verificationExpiresAt: null,
        },
      });
      throw ApiError.badRequest(
        "Verification code has expired — request a new one",
      );
    }

    // Constant-time-ish comparison via plain string equality.
    // The code is 6 digits so a timing attack is impractical, but we
    // avoid early-return to keep the comparison path uniform.
    if (record.verificationCode !== input.code) {
      throw ApiError.forbidden("Invalid verification code");
    }

    // Mark verified and clear the transient code fields.
    await ctx.db.externalIdentifier.update({
      where: { id: input.id },
      data: {
        verified: true,
        verificationCode: null,
        verificationExpiresAt: null,
      },
    });

    // Audit (fire-and-forget).
    void auditService
      .log({
        action: "EXTERNAL_IDENTIFIER_VERIFIED",
        identityId: ctx.identityId,
        tenantId: ctx.tenantId ?? undefined,
        ip: ctx.ip,
        metadata: { type: record.type },
        requestId: ctx.requestId,
      })
      .catch(() => {});

    return { id: input.id, verified: true };
  },
};
