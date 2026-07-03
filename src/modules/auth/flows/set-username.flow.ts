// src/modules/auth/flows/set-username.flow.ts
import { z } from "zod";
import type { FlowContext, Flow } from "@/core/flows";
import { SetUsernameSchema } from "../validators/auth.schemas";
import { IdentityRepository } from "../repositories/identity.repository";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";
import { presentIdentity } from "../presenters/identity.presenter";

type Input = z.infer<typeof SetUsernameSchema>;
type Output = { identity: ReturnType<typeof presentIdentity> };

export const setUsernameFlow: Flow<Input, Output> = {
  name: "auth:set-username",
  inputSchema: SetUsernameSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    if (!ctx.identityId) {
      throw ApiError.unauthorized("Authentication required");
    }

    const identityRepo = new IdentityRepository(ctx.db);

    if (await identityRepo.isUsernameTaken(input.username, ctx.identityId)) {
      throw ApiError.conflict("That username is already taken");
    }

    let identity;
    try {
      identity = await identityRepo.setUsername(ctx.identityId, input.username);
    } catch (err: any) {
      // P2002 = unique constraint violation — the race the pre-check can't close.
      if (err?.code === "P2002") {
        throw ApiError.conflict("That username is already taken");
      }
      throw err;
    }

    await auditService.log(
      { action: "USERNAME_SET", identityId: ctx.identityId, ip: ctx.ip },
      ctx.db,
    );

    return { identity: presentIdentity(identity) };
  },
};
