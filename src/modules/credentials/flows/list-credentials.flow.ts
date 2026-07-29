// src/modules/credentials/flows/list-credentials.flow.ts
import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { CredentialRepository } from "../repositories/credential.repository";
import { presentCredential } from "../presenters/credential.presenter";

export type CredentialListEntry = ReturnType<typeof presentCredential>;

export const listCredentialsFlow: Flow<Record<string, never>, CredentialListEntry[]> = {
  name: "credentials:list",
  inputSchema: z.object({}),

  async execute(_input, ctx: FlowContext) {
    const credRepo = new CredentialRepository(ctx.db);
    const vcs = await credRepo.findByHolder(ctx.identityId ?? "");
    return vcs.map(presentCredential);
  },
};
