// src/lib/security/password-rules.ts
//
// FIX: TenantPolicy.passwordRules was settable via the tenant policy
// update route/schema but read by zero flows — a classic silent no-op
// (the UI could set it, nothing enforced it). This gives it a real,
// typed shape and a validator that auth flows actually call.
//
// Scope note: password-setting flows in this codebase (register,
// password-reset-confirm) operate at the identity level, not scoped to
// a specific non-SYSTEM tenant — an identity can be a member of several
// tenants with different policies, and there's no single tenant to pick
// rules from at registration time. Both of those flows resolve their
// FlowContext.tenantId to "SYSTEM" (see register.route.ts /
// password.route.ts), so enforcement here is scoped to the SYSTEM
// tenant's TenantPolicy. Per-tenant password rules for tenant-invite-based
// registration (a specific non-SYSTEM tenant's rules applying to a new
// member) is a real but separate feature — not built here; tracked in
// arcid-v1-roadmap.md as future work if a tenant-invite registration path
// is added.

import { z } from "zod";
import { ApiError } from "@/core/errors";

export const PasswordRulesSchema = z
  .object({
    minLength: z.number().int().min(1).max(256).optional(),
    requireUppercase: z.boolean().optional(),
    requireLowercase: z.boolean().optional(),
    requireNumber: z.boolean().optional(),
    requireSymbol: z.boolean().optional(),
  })
  .strict();

export type PasswordRules = z.infer<typeof PasswordRulesSchema>;

/**
 * Validate a plaintext password against a set of rules.
 * Returns an array of human-readable violation messages — empty if valid.
 * `rules` may be undefined/null (no TenantPolicy row, or no passwordRules
 * set on it) — in that case there's nothing to enforce beyond whatever
 * the caller's own base schema already requires (e.g. RegisterSchema's
 * min(8)).
 */
export function validatePassword(
  password: string,
  rules: PasswordRules | null | undefined,
): string[] {
  if (!rules) return [];
  const errors: string[] = [];

  if (rules.minLength && password.length < rules.minLength) {
    errors.push(`Password must be at least ${rules.minLength} characters`);
  }
  if (rules.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (rules.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (rules.requireNumber && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (rules.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one symbol");
  }

  return errors;
}

/**
 * Load the SYSTEM tenant's passwordRules (if any) and validate. Throws
 * ApiError.badRequest with all violations joined if the password fails.
 * Safe to call with any DbClient-shaped object exposing tenantPolicy.
 */
export async function enforceSystemPasswordRules(
  db: { tenantPolicy: { findUnique: (args: any) => Promise<any> } },
  password: string,
): Promise<void> {
  const policy = await db.tenantPolicy.findUnique({
    where: { tenantId: "SYSTEM" },
    select: { passwordRules: true },
  });

  const parsed = policy?.passwordRules
    ? PasswordRulesSchema.safeParse(policy.passwordRules)
    : null;

  const rules = parsed?.success ? parsed.data : undefined;
  const errors = validatePassword(password, rules);
  if (errors.length > 0) {
    throw ApiError.badRequest(errors.join("; "));
  }
}
