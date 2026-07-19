import { z } from "zod";
import { UserStatus } from "@prisma-client";

export const CreateTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  sector: z.string().optional(),
});

// Role is now a string (dynamic) — not a Prisma enum
export const AddMemberSchema = z.object({
  identityId: z.string().cuid(),
  role: z.string().min(1).default("MEMBER"),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.string().min(1),
});

export const UpdateMemberStatusSchema = z.object({
  status: z.enum(UserStatus),
});

export const UpdatePolicySchema = z.object({
  requireMfa: z.boolean().optional(),
  passwordRules: z.record(z.string(), z.unknown()).optional(),
  loginMethods: z.array(z.string()).optional(),
});

export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;
export type AddMemberInput = z.infer<typeof AddMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
export type UpdatePolicyInput = z.infer<typeof UpdatePolicySchema>;
