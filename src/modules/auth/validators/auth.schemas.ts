// src/modules/auth/validators/auth.schemas.ts
import { z } from "zod";
import { UserStatus, MfaType } from "@prisma-client";

export const RegisterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z
    .string()
    .email({ message: "Provide a valid operational email address space" }),
  password: z
    .string()
    .min(
      8,
      "Security vector requires a minimum password length of 8 characters",
    ),
});

// Reused by the "set username" route and anywhere else a handle needs validating
// (e.g. future onboarding step-type config for username collection).
// Lowercase-enforced at the schema level so "Alice" and "alice" can't both
// exist as distinct usernames — case-insensitive uniqueness without needing
// a citext column or a Postgres-side lower() index.
export const UsernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-z0-9_]+$/,
    "Username can only contain lowercase letters, numbers, and underscores",
  )
  .refine((v) => !/^\d+$/.test(v), {
    message: "Username cannot be only numbers",
  });

export const SetUsernameSchema = z.object({
  username: UsernameSchema,
});

export const LoginSchema = z.object({
  email: z
    .string()
    .email({ message: "Provide a valid operational email address space" }),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const MfaSetupSchema = z.object({
  type: z.enum(MfaType),
});

// ─────────────────────────────────────────────────────────────────────────────
// SESSION ID FORMAT NOTE:
// SessionService.create() sets id: generateToken(64) → base64url string ~88 chars.
// These schemas previously used z.string() which is WRONG and caused
// every MFA verify/recovery to return 400 (Zod parse error in FlowExecutor).
// Fix: use min(40).max(128) to match the route-level SessionIdSchema.
// ─────────────────────────────────────────────────────────────────────────────
export const SessionIdSchema = z.string().min(40).max(128);

export const MfaVerifySchema = z.object({
  code: z.string().min(6).max(8),
  sessionId: SessionIdSchema,
  // Optional password fallback provided only for targeted high-privilege step-up ceremonies
  password: z.string().min(8).optional(),
});

export const MfaRecoverySchema = z.object({
  code: z.string().length(32),
  sessionId: SessionIdSchema,
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const PasswordResetConfirmSchema = z.object({
  token: z.string(),
  newPassword: z
    .string()
    .min(
      8,
      "New credentials require an extended entropy minimum of 8 characters",
    ),
});

export const PasswordChangeSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

export const EmailVerifySchema = z.object({
  token: z.string(),
});

export const IdentityDtoSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
  emailVerified: z.boolean(),
  name: z.string().nullable(),
  picture: z.string().nullable(),
  roles: z.array(z.string()),
  status: z.enum(UserStatus),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
});

export const SwitchContextSchema = z.object({
  tenantId: z.string().cuid("Invalid tenant ID format"),
});

// ─────────────────────────────────────────────────────────────────────────────
// WEB_AUTHN / PASSKEY HARDENING SCHEMAS (PHASE B)
// ─────────────────────────────────────────────────────────────────────────────
export const WebAuthnChallengeSchema = z.object({
  sessionId: SessionIdSchema,
  challenge: z.string().min(32),
});

export const WebAuthnVerifySchema = z.object({
  sessionId: SessionIdSchema,
  id: z.string(), // Credential ID
  rawId: z.string(),
  clientDataJSON: z.string(), // Cryptographic client state
  authenticatorData: z.string(),
  signature: z.string(),
  userHandle: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// TYPE INFERENCES
// ─────────────────────────────────────────────────────────────────────────────
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type MfaVerifyInput = z.infer<typeof MfaVerifySchema>;
export type PasswordResetRequestInput = z.infer<
  typeof PasswordResetRequestSchema
>;
export type PasswordResetConfirmInput = z.infer<
  typeof PasswordResetConfirmSchema
>;
export type IdentityDto = z.infer<typeof IdentityDtoSchema>;
export type WebAuthnChallengeInput = z.infer<typeof WebAuthnChallengeSchema>;
export type WebAuthnVerifyInput = z.infer<typeof WebAuthnVerifySchema>;
