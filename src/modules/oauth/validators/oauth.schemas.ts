import { z } from "zod";

export const AuthorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  scope: z.string().optional().default("openid profile email"),
  state: z.string().optional(),
  nonce: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(["S256", "plain"]).optional(),
});

export const TokenExchangeSchema = z.discriminatedUnion("grant_type", [
  z.object({
    grant_type: z.literal("authorization_code"),
    code: z.string(),
    redirect_uri: z.string().url(),
    client_id: z.string(),
    client_secret: z.string().optional(),
    code_verifier: z.string().optional(),
  }),
  z.object({
    grant_type: z.literal("refresh_token"),
    refresh_token: z.string(),
    client_id: z.string(),
    client_secret: z.string().optional(),
  }),
  z.object({
    grant_type: z.literal("client_credentials"),
    client_id: z.string(),
    client_secret: z.string(),
    scope: z.string().optional(),
  }),
]);

export const IntrospectSchema = z.object({
  token: z.string(),
  token_type_hint: z.enum(["access_token", "refresh_token"]).optional(),
});

export const RevokeSchema = z.object({
  token: z.string(),
  token_type_hint: z.enum(["access_token", "refresh_token"]).optional(),
});
