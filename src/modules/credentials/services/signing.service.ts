// src/modules/credentials/services/signing.service.ts
import type { DbClient } from "@/lib/db-client";
import type { VcFormat } from "@prisma-client";
import { SignJWT, importPKCS8 } from "jose";
import { ApiError } from "@/core/errors/api-error";
import { SdJwtService } from "./sd-jwt.service";
import { decryptPrivateKey } from "@/lib/kms/key-encryption";

/**
 * VC signing dispatcher.
 *
 * JWT:           jose SignJWT — uses TenantSigningKey private key
 * SD_JWT:        @sd-jwt/core — selective disclosure JWT
 * JSON_LD:       Not yet supported (roadmap)
 * DataIntegrity: Not yet supported (roadmap)
 *
 * Private keys are stored as KMS-encrypted bytes in TenantSigningKey.
 * Decrypted key material exists in memory only for the duration of each
 * sign call — it is not cached, logged, or returned beyond the signing
 * call site.
 */
export class SigningService {
  constructor(private db: DbClient) {}

  async sign(
    payload: Record<string, unknown>,
    issuerDid: string,
    format: VcFormat,
  ): Promise<{ proof: string; signedCredential: string }> {
    switch (format) {
      case "JWT":
        return this.signJwt(payload, issuerDid);
      case "SD_JWT":
        return this.signSdJwt(payload, issuerDid);
      case "JSON_LD":
      case "DataIntegrity":
        throw ApiError.badRequest(
          `${format} signing is not yet supported. Use JWT or SD_JWT.`,
        );
      default:
        throw ApiError.badRequest(`Unknown VcFormat: ${format}`);
    }
  }

  // ── JWT ──────────────────────────────────────────────────────────────────

  private async signJwt(
    payload: Record<string, unknown>,
    issuerDid: string,
  ): Promise<{ proof: string; signedCredential: string }> {
    const signingKey = await this.loadSigningKey(issuerDid);

    // Decrypt the private key — key material exists in memory only for
    // the duration of this sign operation.
    const decrypted = await decryptPrivateKey(signingKey);
    const pemKey = this.derToPem(decrypted, "PRIVATE KEY");
    const privateKey = await importPKCS8(pemKey, signingKey.algorithm);

    const jwt = await new SignJWT({ vc: payload })
      .setProtectedHeader({ alg: signingKey.algorithm, kid: signingKey.kid })
      .setIssuer(issuerDid)
      .setIssuedAt()
      .sign(privateKey);

    return { proof: jwt, signedCredential: jwt };
  }

  // ── SD-JWT ────────────────────────────────────────────────────────────────

  private async signSdJwt(
    payload: Record<string, unknown>,
    issuerDid: string,
  ): Promise<{ proof: string; signedCredential: string }> {
    const signingKey = await this.loadSigningKey(issuerDid);

    // Decrypt the private key — key material exists in memory only for
    // the duration of this sign operation.
    const decrypted = await decryptPrivateKey(signingKey);
    // SdJwtService.sign() accepts a PEM string directly and imports it internally.
    const pemKey = this.derToPem(decrypted, "PRIVATE KEY");

    // All credentialSubject fields except "id" are selectively disclosable
    // by default. Pass an explicit list here to restrict which fields are SD.
    const sdJwtService = new SdJwtService();
    const sdJwt = await sdJwtService.sign(
      payload,
      pemKey,
      [], // empty = default disclosure: all credentialSubject fields except "id"
      signingKey.algorithm,
    );

    return { proof: sdJwt, signedCredential: sdJwt };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async loadSigningKey(issuerDid: string) {
    const did = await this.db.decentralizedIdentifier.findUnique({
      where: { id: issuerDid },
    });

    if (!did) {
      throw ApiError.notFound(`DID not found: ${issuerDid}`);
    }

    if (!did.tenantId) {
      // did.identityId is set instead — an individually-owned DID
      // registered via the wallet-did flow in identity/modules.
      //
      // This is a permanent guard, not a pending feature gap. ArcID is
      // expressly non-custodial for individual DIDs: ArcWallet generates
      // and holds the private key on-device. ArcID only ever receives the
      // public key and verifies signatures — it must never hold a private
      // key capable of signing on behalf of an individual identity.
      //
      // The wallet-did flow creates the DecentralizedIdentifier row with
      // identityId set and tenantId null. Those DIDs are used for
      // wallet-originated presentation proofs verified by
      // verifyCredentialFlow, never for server-side signing.
      throw ApiError.badRequest(
        `DID ${issuerDid} is identity-owned, not tenant-owned. ArcID never signs on behalf of an individual DID — credential issuance requires a tenant-issued DID.`,
      );
    }

    if (did?.tenantId) {
      const key = await this.db.tenantSigningKey.findFirst({
        where: { tenantId: did.tenantId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });
      if (key) return key;
    }

    throw ApiError.internal(
      `No active signing key found for DID: ${issuerDid}`,
    );
  }

  private derToPem(derBytes: Buffer, type: string): string {
    const b64 = derBytes.toString("base64");
    const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
    return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
  }
}
