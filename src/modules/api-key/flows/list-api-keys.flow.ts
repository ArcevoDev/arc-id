import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { ApiKeyRepository } from "../repositories/api-key.repository";
import { ApiError } from "@/core/errors";

const ListInputSchema = z.object({});
type Input = z.infer<typeof ListInputSchema>;

export const listApiKeysFlow: Flow<Input, Array<Record<string, unknown>>> = {
  name: "apiKey:list",
  inputSchema: ListInputSchema,

  async execute(_input, ctx: FlowContext): Promise<Array<Record<string, unknown>>> {
    const identityId = ctx.identityId;
    if (!identityId) throw ApiError.unauthorized("Not authenticated");

    const repo = new ApiKeyRepository(ctx.db);
    return repo.listApiKeys(identityId) as Promise<Array<Record<string, unknown>>>;
  },
};
