import { z } from "zod";
import type { Flow } from "@/core/flows/flow";
import type { FlowContext } from "@/core/flows/flow-context";
import { AuthorizeQuerySchema } from "../validators/oauth.schemas";
import { ClientRepository } from "../repositories/client.repository";
import { ConsentService } from "../services/consent.service";
import { generateToken } from "@/lib/crypto";
import { ApiError } from "@/core/errors/api-error";
import { addMinutes } from "date-fns";

export const authorizeFlow: Flow<z.infer<typeof AuthorizeQuerySchema>> = {
  name: "oauth:authorize",
  inputSchema: AuthorizeQuerySchema,

  async execute(input, ctx: FlowContext) {
    if (!ctx.userId)
      throw ApiError.unauthorized("Must be authenticated to authorize");

    const clientRepo = new ClientRepository(ctx.db);
    const consentService = new ConsentService(ctx.db);

    const client = await clientRepo.findByClientIdOrThrow(
      input.client_id,
      ctx.tenantId,
    );

    const uriValid = await clientRepo.validateRedirectUri(
      client.id,
      input.redirect_uri,
    );
    if (!uriValid)
      throw ApiError.invalidRequest(
        "redirect_uri is not registered for this client",
      );

    const rawScope = (input as any).scope as string | undefined;
    const requestedScopes = rawScope
      ? rawScope.split(" ")
      : (client.scopes as string[]);
    const hasConsent = await consentService.hasConsent(
      ctx.userId,
      client.id,
      requestedScopes,
    );

    // Return consent_required so the UI can show a consent screen
    if (!hasConsent) {
      return {
        consentRequired: true,
        clientName: client.name,
        scopes: requestedScopes,
      };
    }

    const code = generateToken(32);
    await ctx.db.authorizationCode.create({
      data: {
        code,
        clientId: client.id,
        identityId: ctx.userId,
        redirectUri: input.redirect_uri,
        scopes: requestedScopes,
        nonce: input.nonce,
        codeChallenge: input.code_challenge,
        codeChallengeMethod: input.code_challenge_method,
        expiresAt: addMinutes(new Date(), 5),
      },
    });

    return { code, state: input.state, consentRequired: false };
  },
};
