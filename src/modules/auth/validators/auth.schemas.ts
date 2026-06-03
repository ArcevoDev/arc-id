// src/modules/auth/validators/auth.schemas.ts
import { z } from "zod";
import { UserStatus, MfaType } from "@/prisma-client";

export const RegisterSchema = z.object({
  email: z.string().email("Provide a valid operational email address space"),
  password: z
    .string()
    .min(8, "Security vector requires a minimum password length of 8 characters"),
  name: z.string().min(1).max(100).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email("Provide a valid operational email address space"),
  password: z.string(),
});

export const MfaSetupSchema = z.object({
  type: z.nativeEnum(MfaType),
});

export const MfaVerifySchema = z.object({
  code: z.string().min(6).max(8),
  sessionId: z.string().cuid(),
});

export const MfaRecoverySchema = z.object({
  code: z.string().length(32),
  sessionId: z.string().cuid(),
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const PasswordResetConfirmSchema = z.object({
  token: z.string(),
  newPassword: z
    .string()
    .min(12, "New credentials require an extended entropy minimum of 12 characters"),
});

export const PasswordChangeSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(12),
});

export const EmailVerifySchema = z.object({
  token: z.string(),
});

export const IdentityDtoSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email().nullable(),
  emailVerified: z.boolean(),
  name: z.string().nullable(),
  picture: z.string().nullable(),
  roles: z.array(z.string()),
  status: z.nativeEnum(UserStatus),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
});

export const SwitchContextSchema = z.object({
  tenantId: z.string().cuid("Invalid tenant ID format"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type MfaVerifyInput = z.infer<typeof MfaVerifySchema>;
export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof PasswordResetConfirmSchema>;
export type IdentityDto = z.infer<typeof IdentityDtoSchema>;