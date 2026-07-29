import type { VerifiableCredential } from "@prisma-client";

/** W3C Verifiable Credential presenter — exposes all stored VC fields for external consumption. */
export function presentCredential(vc: VerifiableCredential) {
  return {
    id: vc.id,
    context: vc.context,
    type: vc.type,
    format: vc.format,
    issuerDid: vc.issuerDid,
    subjectDid: vc.subjectDid,
    holderId: vc.holderId,
    credentialSubject: vc.credentialSubject,
    proof: vc.proof,
    statusListIndex: vc.statusListIndex,
    statusListId: vc.statusListId,
    schemaId: vc.schemaId,
    issuedAt: vc.issuedAt,
    expiresAt: vc.expiresAt,
    createdAt: vc.createdAt,
  };
}
