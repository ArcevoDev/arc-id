import type { VerifiableCredential } from "@prisma-client";

export function presentCredential(vc: VerifiableCredential) {
  return {
    id: vc.id,
    format: vc.format,
    issuerDid: vc.issuerDid,
    subjectDid: vc.subjectDid,
    issuedAt: vc.issuedAt,
    expiresAt: vc.expiresAt,
    credentialSubject: vc.credentialSubject,
  };
}
