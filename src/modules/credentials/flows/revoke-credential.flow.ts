import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { RevokeCredentialSchema } from "../validators/credential.schemas";
import { CredentialRepository } from "../repositories/credential.repository";
import { StatusListService } from "../services/status-list.service";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";

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

    await statusListService.updateEntry(vc.statusListId, vc.statusListIndex, 1); // 1 = revoked

    auditService.log({
      action: "CREDENTIAL_REVOKED",
      identityId: ctx.userId,
      tenantId: ctx.tenantId ?? undefined,
    });

    return {};
  },
};
