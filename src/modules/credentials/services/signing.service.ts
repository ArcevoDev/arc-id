import type { DbClient } from "@/lib/db-client";
import type { VcFormat } from "@/prisma-client";
import { SignJWT, importPKCS8 } from "jose";
import { ApiError } from "@/core/errors/api-error";

/**
 * VC signing dispatcher.
 *
 * JWT:          jose SignJWT — uses TenantSigningKey private key
 * SD_JWT:      @sd-jwt/core — selective disclosure JWT
 * JSON_LD:     Not yet supported (roadmap)
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

    // ✨ Fixed: Removed trailing stray bracket and wrapped core privateKey inside Buffer.from()
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

  // ✨ Fixed: Declared the explicit return signature type so TypeScript stops complaining about an implicit void fallback
  private async signSdJwt(
    payload: Record<string, unknown>,
    issuerDid: string,
  ): Promise<{ proof: string; signedCredential: string }> {
    /**
     * Full SD-JWT implementation requires:
     * pnpm add @sd-jwt/core @sd-jwt/crypto-nodejs
     */
    throw ApiError.badRequest(
      "SD-JWT signing requires @sd-jwt/core — run: pnpm add @sd-jwt/core @sd-jwt/crypto-nodejs",
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async loadSigningKey(issuerDid: string) {
    const did = await this.db.decentralizedIdentifier.findUnique({
      where: { id: issuerDid },
    });

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
