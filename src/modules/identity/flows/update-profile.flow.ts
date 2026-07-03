import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { UpdateProfileSchema } from "../validators/identity.schemas";
import { ProfileService } from "../services/profile.service";
import { presentIdentity } from "../presenters/identity.presenter";
import { ApiError } from "@/core/errors/api-error";

type Input = z.infer<typeof UpdateProfileSchema>;
type Output = { identity: ReturnType<typeof presentIdentity> };

export const updateProfileFlow: Flow<Input, Output> = {
  name: "identity:update-profile",
  inputSchema: UpdateProfileSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    if (!ctx.identityId) throw ApiError.unauthorized("Authentication required");

    // ctx.db matches perfectly now
    const profileService = new ProfileService(ctx.db);
    const identity = await profileService.update(ctx.identityId, input);

    return { identity: presentIdentity(identity) };
  },
};
