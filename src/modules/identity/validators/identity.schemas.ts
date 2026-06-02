import { z } from "zod";

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  picture: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const LinkOAuthSchema = z.object({
  provider: z.string(),
  providerUserId: z.string(),
});
