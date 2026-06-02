import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { UpdateProfileSchema } from "../validators/identity.schemas";
import { ProfileService } from "../services/profile.service";
import { presentIdentity } from "../presenters/identity.presenter";
import { ApiError } from "@/core/errors/api-error";

export const updateProfileFlow: Flow<z.infer<typeof UpdateProfileSchema>> = {
  name: "identity:update-profile",
  inputSchema: UpdateProfileSchema,

  async execute(input, ctx: FlowContext) {
    if (!ctx.userId) throw ApiError.unauthorized();
    const profileService = new ProfileService(ctx.db);
    const identity = await profileService.update(ctx.userId, input);
    return { identity: presentIdentity(identity) };
  },
};
