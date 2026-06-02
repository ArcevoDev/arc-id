import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { VerifyCredentialSchema } from "../validators/credential.schemas";
import { DidService } from "../services/did.service";
import { StatusListService } from "../services/status-list.service";
import { jwtVerify, importSPKI, createRemoteJWKSet, decodeJwt } from "jose";

interface VerifyResult {
  valid: boolean;
  reason?: string;
  claims?: Record<string, unknown>;
}

export const verifyCredentialFlow: Flow<
  z.infer<typeof VerifyCredentialSchema>,
  VerifyResult
> = {
  name: "credentials:verify",
  inputSchema: VerifyCredentialSchema,

  async execute(input, ctx: FlowContext): Promise<VerifyResult> {
    try {
      // ── 1. Decode header without verifying ───────────────────────────────
      const decoded = decodeJwt(input.credential);
      const issuerDid = decoded.iss as string;
      if (!issuerDid)
        return { valid: false, reason: "Missing issuer (iss) claim" };

      // ── 2. Resolve issuer DID ────────────────────────────────────────────
      const didService = new DidService(ctx.db);
      const didRecord = await didService.resolve(issuerDid);

      let verifiedPayload: Record<string, unknown>;

      if (didRecord) {
        // Local DID — use stored public key
        const pem = derToPem(
          Buffer.from(didRecord.publicKeyBytes),
          "PUBLIC KEY",
        );
        const publicKey = await importSPKI(pem, "ES256"); // or RS256 depending on keyType
        const { payload } = await jwtVerify(input.credential, publicKey, {
          issuer: issuerDid,
        });
        verifiedPayload = payload as Record<string, unknown>;
      } else {
        // External DID — attempt did:web JWKS resolution
        if (!issuerDid.startsWith("did:web:")) {
          return {
            valid: false,
            reason: `Cannot resolve external DID: ${issuerDid}`,
          };
        }
        const domain = issuerDid.replace("did:web:", "");
        const jwksUrl = new URL(`https://${domain}/.well-known/jwks.json`);
        const JWKS = createRemoteJWKSet(jwksUrl);
        const { payload } = await jwtVerify(input.credential, JWKS, {
          issuer: issuerDid,
        });
        verifiedPayload = payload as Record<string, unknown>;
      }

      // ── 3. Check expiry ───────────────────────────────────────────────────
      const vc = (verifiedPayload.vc ?? verifiedPayload) as any;
      if (vc.expirationDate && new Date(vc.expirationDate) < new Date()) {
        return { valid: false, reason: "Credential has expired" };
      }

      // ── 4. Check status list ──────────────────────────────────────────────
      const credentialStatus = vc.credentialStatus;
      if (credentialStatus) {
        const listId = credentialStatus.statusListCredential?.split("/").pop();
        const index = parseInt(credentialStatus.statusListIndex, 10);

        if (listId && !isNaN(index)) {
          const statusListService = new StatusListService(ctx.db);
          try {
            const bitValue = await statusListService.checkEntry(listId, index);
            if (bitValue === 1) {
              return { valid: false, reason: "Credential has been revoked" };
            }
          } catch {
            // Status list not found locally — skip check (external issuer)
          }
        }
      }

      return { valid: true, claims: verifiedPayload };
    } catch (err: any) {
      const msg = err?.code ?? err?.message ?? "Verification failed";
      if (msg.includes("JWTExpired"))
        return { valid: false, reason: "Credential JWT has expired" };
      if (msg.includes("JWSSignatureVerificationFailed"))
        return { valid: false, reason: "Invalid signature" };
      return { valid: false, reason: msg };
    }
  },
};

function derToPem(derBytes: Buffer, type: string): string {
  const b64 = derBytes.toString("base64");
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
}
