// src/core/errors/error-schemas.ts
import { z } from "zod";

export const commonErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
});