import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { config } from "@/core/config";
import { IssueCredentialSchema } from "../validators/credential.schemas";
import { DidService } from "../services/did.service";
import { SigningService } from "../services/signing.service";
import { StatusListService } from "../services/status-list.service";
import { ApiError } from "@/core/errors/api-error";
import { auditService } from "@/modules/audit/services/audit.service";
import { randomUUID } from "crypto";
import { notificationService } from "@/lib/notifications/notification.service";

type Input = z.infer<typeof IssueCredentialSchema>;

type Output = {
  credentialId: string;
  credential: string | Record<string, any>;
};

export const issueCredentialFlow: Flow<Input, Output> = {
  name: "credentials:issue",
  inputSchema: IssueCredentialSchema,

  async execute(input, ctx: FlowContext): Promise<Output> {
    if (!ctx.tenantId) {
      throw ApiError.badRequest("tenantId required for credential issuance");
    }

    const didService = new DidService(ctx.db);
    const signingService = new SigningService(ctx.db);
    const statusListService = new StatusListService(ctx.db);

    // 1. Resolve issuer DID (Must belong to executing business tenant sandbox)
    const tenantDid = await ctx.db.decentralizedIdentifier.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    if (!tenantDid) {
      throw ApiError.notFound("Tenant DID not configured");
    }

    // 2. Validate cryptographic target verification relationship
    await didService.resolveOrThrow(input.subjectDid);

    // 3. Allocate tracking slot inside the explicit Bitstring Status List layout
    const { listId, index } =
      await statusListService.allocateIndex("REVOCATION");

    // 4. Construct structural payload adhering strictly to W3C Credential Core specifications
    const vcId = `urn:uuid:${randomUUID()}`;
    const baseApiUrl = config.base.apiUrl;

    const payload = {
      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        id: vcId,
        type: ["VerifiableCredential"],
        issuer: tenantDid.id,
        issuanceDate: new Date().toISOString(),
        expirationDate: input.expiresAt,
        credentialSubject: {
          id: input.subjectDid,
          ...input.credentialSubject,
        },
        credentialStatus: {
          id: `${baseApiUrl}/credentials/status-lists/${listId}#${index}`,
          type: "BitstringStatusListEntry",
          statusPurpose: "revocation",
          statusListIndex: String(index),
          statusListCredential: `${baseApiUrl}/credentials/status-lists/${listId}`,
        },
      },
    };

    // 5. Compute cryptographic data proof context (e.g., JWT, SD-JWT, or Data Integrity signatures)
    const { signedCredential, proof } = await signingService.sign(
      payload,
      tenantDid.id,
      input.format,
    );

    // 6. Persist structured metadata into cold storage ledger metrics
    const vc = await ctx.db.verifiableCredential.create({
      data: {
        id: vcId,
        context: ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential"],
        format: input.format,
        issuerDid: tenantDid.id,
        subjectDid: input.subjectDid,
        holderId: input.holderId,
        credentialSubject: input.credentialSubject as any, // Cast securely to Prisma JsonValue representation
        proof: proof as any,
        statusListId: listId,
        statusListIndex: index,
        schemaId: input.schemaId,
        issuedAt: new Date(),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
    });

    auditService.log({
      action: "CREDENTIAL_ISSUED",
      identityId: ctx.userId,
      tenantId: ctx.tenantId,
    });

    if (input.holderId) {
      const holder = await ctx.db.identity.findUnique({
        where: { id: input.holderId },
        select: { primaryEmail: true, name: true },
      });
      if (holder?.primaryEmail) {
        void notificationService.sendCredentialIssued(holder.primaryEmail, {
          holderName: holder.name ?? undefined,
          credentialType: "VerifiableCredential",
          issuerName: tenantDid.id,
          credentialId: vcId,
          expiresAt: input.expiresAt,
        });
      }
    }

    return {
      credentialId: vc.id,
      credential: signedCredential,
    };
  },
};
