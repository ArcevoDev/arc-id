import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { RevokeApiKeySchema } from "../validators/api-key.schemas";
import { ApiKeyRepository } from "../repositories/api-key.repository";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";

type Input = z.infer<typeof RevokeApiKeySchema>;

export const revokeApiKeyFlow: Flow<Input> = {
  name: "apiKey:revoke",
  inputSchema: RevokeApiKeySchema,

  async execute(input, ctx: FlowContext): Promise<void> {
    const identityId = ctx.identityId;
    const tenantId = ctx.tenantId;
    if (!identityId) throw ApiError.unauthorized("Not authenticated");
    if (!tenantId) throw ApiError.badRequest("Tenant context required");

    const repo = new ApiKeyRepository(ctx.db);

    const result = await repo.revokeApiKey(input.id, tenantId);

    if (result.count === 0) {
      throw ApiError.notFound("API key not found or already revoked");
    }

    void auditService
      .log({
        action: "API_KEY_REVOKED",
        identityId,
        tenantId,
        ip: ctx.ip,
        metadata: { apiKeyId: input.id },
      })
      .catch(() => {});
  },
};
