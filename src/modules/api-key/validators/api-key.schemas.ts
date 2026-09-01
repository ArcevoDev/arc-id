import { z } from "zod";

export const CreateApiKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(128),
  scopes: z.array(z.string()).default(["identity:read"]),
});

export const RevokeApiKeySchema = z.object({
  id: z.string().cuid(),
});
