// src/modules/credentials/flows/issue-credential.flow.ts
import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { config } from "@/core/config";
import { IssueCredentialSchema } from "../validators/credential.schemas";
import { DidService } from "../services/did.service";
import { SigningService } from "../services/signing.service";
import { StatusListService } from "../services/status-list.service";
import { ApiError } from "@/core/errors";
import { auditService } from "@/modules/audit/services/audit.service";
import { randomUUID } from "crypto";
import { notificationService } from "@/lib/notifications/notification.service";
import { dispatchWebhookEvent } from "@/lib/webhooks/webhook-dispatcher";

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

    const tenantDid = await ctx.db.decentralizedIdentifier.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    if (!tenantDid) {
      throw ApiError.notFound("Tenant DID not configured");
    }

    await didService.resolveOrThrow(input.subjectDid);

    const vcId = `urn:uuid:${randomUUID()}`;
    const baseApiUrl = config.base.apiUrl;

    // Allocation + VC creation now share a single database transaction.
    // If the process crashes or an error throws mid-flight (e.g. during sign),
    // the allocated index rolls back automatically, eliminating dead slots.
    const result = await (ctx.db as any).$transaction(
      async (tx: any) => {
        // Pass the transaction client 'tx' down to enforce the optimistic locking guard
        const { listId, index } = await statusListService.allocateIndex(
          "REVOCATION",
          ctx.tenantId,
          tx,
        );

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

        const { signedCredential, proof } = await signingService.sign(
          payload,
          tenantDid.id,
          input.format,
        );

        const created = await tx.verifiableCredential.create({
          data: {
            id: vcId,
            context: ["https://www.w3.org/2018/credentials/v1"],
            type: ["VerifiableCredential"],
            format: input.format,
            issuerDid: tenantDid.id,
            subjectDid: input.subjectDid,
            holderId: input.holderId,
            credentialSubject: input.credentialSubject as any,
            proof: proof as any,
            statusListId: listId,
            statusListIndex: index,
            schemaId: input.schemaId,
            issuedAt: new Date(),
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
          },
        });

        return { created, signedCredential };
      },
      {
        timeout: 10000, // Mitigation if signingService.sign calls out to an external KMS
      },
    );

    // Side effects (Audit, Notification, Webhook) remain completely outside the transaction
    // block to ensure we don't hold database connections open for long operations.
    void auditService
      .log({
        action: "CREDENTIAL_ISSUED",
        identityId: ctx.identityId,
        tenantId: ctx.tenantId,
      })
      .catch(() => {});

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

    void dispatchWebhookEvent(ctx.db, {
      tenantId: ctx.tenantId,
      identityId: ctx.identityId,
      eventType: "CREDENTIAL_ISSUED",
      payload: {
        credentialId: vcId,
        subjectDid: input.subjectDid,
        holderId: input.holderId ?? null,
        format: input.format,
      },
    }).catch(() => {});

    return {
      credentialId: result.created.id,
      credential: result.signedCredential,
    };
  },
};
