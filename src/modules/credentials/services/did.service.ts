import type { DbClient } from "@/lib/db-client";
import { ApiError } from "@/core/errors/api-error";

/**
 * did:web construction and resolution.
 * No Veramo dependency needed for did:web.
 * Uses the did-resolver package for external DID resolution.
 */
export class DidService {
  constructor(private db: DbClient) {}

  async resolve(did: string) {
    return this.db.decentralizedIdentifier.findUnique({ where: { id: did } });
  }

  async resolveOrThrow(did: string) {
    const record = await this.resolve(did);
    if (!record) throw ApiError.notFound(`DID not found: ${did}`);
    return record;
  }

  // NOTE: buildDidDocument() was removed here — it was dead code (no
  // callers) that paired type: keyType with publicKeyMultibase
  // regardless of what keyType actually was, which is spec-incorrect for
  // JsonWebKey2020 (needs publicKeyJwk, not publicKeyMultibase). DID
  // document construction now lives next to whatever creates the
  // underlying key material, so the type/property pairing can't drift
  // from the actual key format:
  //   - tenant did:web  → provision-tenant-did.flow.ts (JsonWebKey2020 + publicKeyJwk)
  //   - wallet did:key  → register-wallet-did.flow.ts (Ed25519VerificationKey2020/
  //                       JsonWebKey2020, both matched correctly to their key type)
}
