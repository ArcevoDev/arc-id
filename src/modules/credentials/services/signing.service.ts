// src/modules/credentials/services/signing.service.ts
import type { DbClient } from "@/lib/db-client";
import type { VcFormat } from "@/prisma-client";
import { SignJWT, importPKCS8 } from "jose";
import { ApiError } from "@/core/errors/api-error";
import { SdJwtService } from "./sd-jwt.service";

/**
 * VC signing dispatcher.
 *
 * JWT:           jose SignJWT — uses TenantSigningKey private key
 * SD_JWT:        @sd-jwt/core — selective disclosure JWT
 * JSON_LD:       Not yet supported (roadmap)
 * DataIntegrity: Not yet supported (roadmap)
 *
 * Private keys are stored as encrypted bytes in TenantSigningKey.
 * In production these should be KMS-wrapped (see kmsProvider field).
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

    const pemKey = this.derToPem(
      Buffer.from(signingKey.privateKey),
      "PRIVATE KEY",
    );
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

    // Convert the stored DER-encoded private key bytes to a PKCS8 PEM string.
    // SdJwtService.sign() accepts a PEM string directly and imports it internally.
    const pemKey = this.derToPem(
      Buffer.from(signingKey.privateKey),
      "PRIVATE KEY",
    );

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
      // did.identityId is set instead — an individually-owned DID.
      // Not supported in v1: TenantSigningKey requires a tenantId (it's a
      // required FK to Tenant, not nullable), and no route currently
      // creates an identityId-scoped DID. If/when that becomes a real v2
      // feature, this needs: (1) a migration adding a nullable
      // identityId column to TenantSigningKey (or a parallel
      // IdentitySigningKey model), (2) a branch here to query it, and
      // (3) a real route that can actually create an identity-owned DID
      // in the first place — none of which exist today, so failing
      // clearly here is more honest than half-building one piece of a
      // three-piece feature.
      throw ApiError.badRequest(
        `DID ${issuerDid} is identity-owned, not tenant-owned. Individually-owned DID signing is not supported yet — credential issuance currently requires a tenant-issued DID.`,
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
