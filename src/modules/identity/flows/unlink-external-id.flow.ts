// src/modules/identity/flows/unlink-external-id.flow.ts
//
// Self-service external identifier unlinking. Only the owning identity
// can unlink their own identifiers. Deleting an ExternalIdentifier row
// has no effect on already-issued VerifiableCredentials — they are fully
// independent signed artifacts (credentialSubject references DIDs, not
// ExternalIdentifier FKs).

import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";

const Input = z.object({
  id: z.string(),
  identityId: z.string().cuid(),
});

type Output = void;

export const unlinkExternalIdFlow: Flow<z.infer<typeof Input>, Output> = {
  name: "identity:unlink-external-id",
  inputSchema: Input,

  async execute(input, ctx: FlowContext): Promise<Output> {
    // Verify ownership before deleting
    const existing = await ctx.db.externalIdentifier.findUnique({
      where: { id: input.id },
      select: { identityId: true, type: true },
    });

    if (!existing) {
      throw ApiError.notFound("External identifier not found");
    }

    if (existing.identityId !== input.identityId) {
      throw ApiError.forbidden("You can only unlink your own identifiers");
    }

    await ctx.db.externalIdentifier.delete({
      where: { id: input.id },
    });

    // Audit (fire-and-forget)
    void auditService
      .log({
        action: "EXTERNAL_IDENTIFIER_UNLINKED",
        identityId: input.identityId,
        metadata: { type: existing.type },
      })
      .catch(() => {});

    return;
  },
};
