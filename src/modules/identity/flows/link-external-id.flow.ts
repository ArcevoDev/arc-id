// src/modules/identity/flows/link-external-id.flow.ts
//
// Self-service external identifier linking. The user provides a type + raw
// value; the server SHA-256-hashes the value and stores only the hash.
// The raw value is never persisted.
//
// NOTE: verified is always false at creation. No automated verification
// path exists yet — VC issuance (issue-credential.flow.ts) does not
// currently check or update ExternalIdentifier records. Tracked follow-up,
// not a bug.

import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { LinkExternalIdSchema } from "../validators/external-id.schemas";
import { sha256 } from "@/lib/crypto";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";

const Input = LinkExternalIdSchema.extend({
  identityId: z.string().cuid(),
});

type Output = {
  id: string;
  type: string;
  displayValue: string | null;
  verified: boolean;
  createdAt: Date;
};

export const linkExternalIdFlow: Flow<z.infer<typeof Input>, Output> = {
  name: "identity:link-external-id",
  inputSchema: Input,

  async execute(input, ctx: FlowContext): Promise<Output> {
    const valueHash = sha256(input.value.trim().toLowerCase());

    // Check uniqueness — [type, valueHash] must not already exist
    const existing = await ctx.db.externalIdentifier.findUnique({
      where: {
        type_valueHash: {
          type: input.type,
          valueHash,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw ApiError.conflict(
        "This external identifier is already linked to an account",
      );
    }

    const record = await ctx.db.externalIdentifier.create({
      data: {
        identityId: input.identityId,
        type: input.type,
        valueHash,
        displayValue: input.displayValue ?? null,
        verified: false,
      },
      select: {
        id: true,
        type: true,
        displayValue: true,
        verified: true,
        createdAt: true,
      },
    });

    // Audit (fire-and-forget)
    void auditService
      .log({
        action: "EXTERNAL_IDENTIFIER_LINKED",
        identityId: input.identityId,
        metadata: { type: input.type },
      })
      .catch(() => {});

    return record;
  },
};
