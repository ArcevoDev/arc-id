import { z } from "zod";
import type { Flow, FlowContext } from "@/core/flows";
import { IssueCredentialSchema } from "../validators/credential.schemas";
import { issueCredentialFlow } from "./issue-credential.flow";
import { ApiError } from "@/core/errors";
import { randomUUID } from "crypto";

// ─── Create Offer ─────────────────────────────────────────────────────────────

const CreateOfferSchema = IssueCredentialSchema;

type CreateInput = z.infer<typeof CreateOfferSchema>;

type CreateOutput = {
  token: string;
  expiresAt: string;
};

export const createOfferFlow: Flow<CreateInput, CreateOutput> = {
  name: "credentials:offer:create",
  inputSchema: CreateOfferSchema,

  async execute(input, ctx: FlowContext): Promise<CreateOutput> {
    if (!ctx.tenantId) {
      throw ApiError.badRequest("tenantId required for credential offer");
    }

    const tenantDid = await ctx.db.decentralizedIdentifier.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!tenantDid) {
      throw ApiError.notFound("Tenant DID not configured");
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // +1 hour

    await ctx.db.credentialOffer.create({
      data: {
        token,
        issuerDid: tenantDid.id,
        subjectDid: input.subjectDid,
        holderId: input.holderId,
        format: input.format,
        credentialSubject: input.credentialSubject as any,
        schemaId: input.schemaId,
        credentialExpiresAt: input.expiresAt
          ? new Date(input.expiresAt)
          : undefined,
        expiresAt,
        status: "PENDING",
        consumed: false,
      },
    });

    return { token, expiresAt: expiresAt.toISOString() };
  },
};

// ─── Accept Offer ─────────────────────────────────────────────────────────────

const AcceptOfferSchema = z.object({
  token: z.string().uuid(),
});

type AcceptInput = z.infer<typeof AcceptOfferSchema>;

type AcceptOutput = {
  credentialId: string;
  credential: string | Record<string, any>;
};

export const createAcceptFlow: Flow<AcceptInput, AcceptOutput> = {
  name: "credentials:offer:accept",
  inputSchema: AcceptOfferSchema,

  async execute(input, ctx: FlowContext): Promise<AcceptOutput> {
    const offer = await ctx.db.credentialOffer.findUnique({
      where: { token: input.token },
    });

    if (!offer) {
      throw ApiError.notFound("Credential offer not found");
    }

    if (offer.consumed || offer.status === "ACCEPTED") {
      throw new ApiError(
        "This credential offer has already been accepted",
        409,
        "OFFER_ALREADY_ACCEPTED",
      );
    }

    if (offer.expiresAt < new Date()) {
      throw new ApiError(
        "This credential offer has expired",
        409,
        "OFFER_EXPIRED",
      );
    }

    // Verify the authenticated user controls the subject DID
    const userDid = await ctx.db.decentralizedIdentifier.findFirst({
      where: {
        id: offer.subjectDid,
        identityId: ctx.identityId,
      },
      select: { id: true },
    });
    if (!userDid) {
      throw ApiError.forbidden(
        "You do not control the subject DID for this offer",
      );
    }

    // Build the input for issueCredentialFlow from the stored offer data
    const issueInput = {
      subjectDid: offer.subjectDid,
      holderId: offer.holderId,
      schemaId: offer.schemaId,
      format: offer.format,
      credentialSubject: offer.credentialSubject as Record<string, unknown>,
      expiresAt: offer.credentialExpiresAt?.toISOString(),
    };

    // Call issueCredentialFlow directly — it handles its own transaction
    // nesting via savepoints within the outer flowExecutor transaction.
    const parsedIssueInput = issueCredentialFlow.inputSchema.parse(issueInput);
    const result = await issueCredentialFlow.execute(parsedIssueInput, ctx);

    // Mark the offer as accepted
    await ctx.db.credentialOffer.update({
      where: { id: offer.id },
      data: { consumed: true, status: "ACCEPTED" },
    });

    return {
      credentialId: result.credentialId,
      credential: result.credential,
    };
  },
};
