import { z } from "zod";

export const EXTERNAL_ID_TYPES = [
  "email",
  "phone",
  "nin",
  "bvn",
  "passport",
  "driver_license",
] as const;

export const LinkExternalIdSchema = z.object({
  type: z.enum(EXTERNAL_ID_TYPES, {
    message:
      "Type must be one of: email, phone, nin, bvn, passport, driver_license",
  }),
  value: z
    .string()
    .min(1, "Identifier value is required")
    .max(512, "Identifier value is too long"),
  displayValue: z.string().max(128).optional(),
});

export const ExternalIdResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  displayValue: z.string().nullable(),
  verified: z.boolean(),
  createdAt: z.date(),
});
