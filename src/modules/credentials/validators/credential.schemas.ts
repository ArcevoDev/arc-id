import { z } from "zod";
import { VcFormat } from "@prisma-client";

// ─── Input Schemas ────────────────────────────────────────────────────────────

export const IssueCredentialSchema = z.object({
  subjectDid: z.string().startsWith("did:"),
  holderId: z.string().cuid().optional(),
  schemaId: z.string().optional(),
  /**
   * Credential serialisation format.
   * Sourced from DB enum — add new formats via Prisma migration only.
   */
  format: z.enum(VcFormat).default(VcFormat.JWT),
  credentialSubject: z.record(z.string(), z.unknown()),
  expiresAt: z.string().datetime().optional(),
});

export const VerifyCredentialSchema = z.object({
  credential: z.string(), // Raw JWT or serialised VC
  format: z.enum(VcFormat).optional(),
});

export const RevokeCredentialSchema = z.object({
  credentialId: z.string(),
  reason: z.string().optional(),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type IssueCredentialInput = z.infer<typeof IssueCredentialSchema>;
export type VerifyCredentialInput = z.infer<typeof VerifyCredentialSchema>;
export type RevokeCredentialInput = z.infer<typeof RevokeCredentialSchema>;
