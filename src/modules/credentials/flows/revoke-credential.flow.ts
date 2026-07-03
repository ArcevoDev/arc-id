// src/modules/credentials/flows/revoke-credential.flow.ts
import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { RevokeCredentialSchema } from "../validators/credential.schemas";
import { CredentialRepository } from "../repositories/credential.repository";
import { StatusListService } from "../services/status-list.service";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { dispatchWebhookEvent } from "@/lib/webhooks/webhook-dispatcher";

export const revokeCredentialFlow: Flow<
  z.infer<typeof RevokeCredentialSchema>
> = {
  name: "credentials:revoke",
  inputSchema: RevokeCredentialSchema,

  async execute(input, ctx: FlowContext) {
    const credRepo = new CredentialRepository(ctx.db);
    const statusListService = new StatusListService(ctx.db);

    const vc = await credRepo.findByIdOrThrow(input.credentialId);
    if (!vc.statusListId || vc.statusListIndex === null) {
      throw ApiError.badRequest("Credential does not have a status list entry");
    }

    // Update the BitstringStatusList — 1 = revoked
    await statusListService.updateEntry(vc.statusListId, vc.statusListIndex, 1);

    void auditService
      .log({
        action: "CREDENTIAL_REVOKED",
        identityId: ctx.identityId,
        tenantId: ctx.tenantId ?? undefined,
      })
      .catch(() => {});

    // Dispatch to tenant webhook endpoints
    void dispatchWebhookEvent(ctx.db, {
      tenantId: ctx.tenantId,
      identityId: ctx.identityId,
      eventType: "CREDENTIAL_REVOKED",
      payload: { credentialId: input.credentialId },
    }).catch(() => {});

    return {};
  },
};
