import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { CreateApiKeySchema } from "../validators/api-key.schemas";
import { ApiKeyService } from "../services/api-key.service";
import { ApiKeyRepository } from "../repositories/api-key.repository";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";

type Input = z.infer<typeof CreateApiKeySchema>;
type Output = {
  id: string;
  key: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: Date;
};

export const createApiKeyFlow: Flow<Input, Output> = {
  name: "apiKey:create",
  inputSchema: CreateApiKeySchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    const identityId = ctx.identityId;
    const tenantId = ctx.tenantId;
    if (!identityId) throw ApiError.unauthorized("Not authenticated");
    if (!tenantId) throw ApiError.badRequest("Tenant context required");

    const service = new ApiKeyService();
    const repo = new ApiKeyRepository(ctx.db);

    const { key, hash, prefix } = service.generate();

    const created = await repo.createApiKey({
      tenantId,
      identityId,
      name: input.name,
      keyHash: hash,
      keyPrefix: prefix,
      scopes: input.scopes,
    });

    void auditService
      .log({
        action: "API_KEY_CREATED",
        identityId,
        tenantId,
        ip: ctx.ip,
        metadata: { apiKeyId: created.id, name: input.name },
      })
      .catch(() => {});

    return {
      id: created.id,
      key, // plaintext — shown ONCE
      name: created.name,
      keyPrefix: created.keyPrefix,
      scopes: created.scopes as string[],
      createdAt: created.createdAt,
    };
  },
};
