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

  buildDidDocument(did: string, publicKeyHex: string, keyType: string) {
    return {
      "@context": ["https://www.w3.org/ns/did/v1"],
      id: did,
      verificationMethod: [
        {
          id: `${did}#key-1`,
          type: keyType,
          controller: did,
          publicKeyMultibase: publicKeyHex,
        },
      ],
      authentication: [`${did}#key-1`],
      assertionMethod: [`${did}#key-1`],
    };
  }
}
