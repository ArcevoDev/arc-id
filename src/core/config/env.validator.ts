import "dotenv/config";
import { z } from "zod";

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    LOG_LEVEL: z.string().default("info"),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().url(),

    // OAuth / Gateways
    ARCID_DIRECT_CLIENT_ID: z.string().default("arcid-direct"),
    ARCBASE_WEBHOOK_URL: z
      .string()
      .url()
      .default("http://localhost:3000/api/webhooks/arcid"),
    API_BASE_URL: z.string().url().default("http://localhost:4000"),
    ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),

    // JWT Config Tokens
    JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
    JWT_ISSUER: z.string().default("arcid"),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("7d"),

    // Passkey / WebAuthn Options
    WEBAUTHN_RP_ID: z.string().default("localhost"),
    WEBAUTHN_RP_NAME: z.string().default("ArcID"),
    WEBAUTHN_ORIGIN: z.string().url().default("http://localhost:3000"),

    // Upstash Redis Token Cache Layer
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

    // Mail Delivery Communication Vector
    RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
    EMAIL_FROM: z.string().default("ArcID <noreply@arcevocirqle.com.ng>"),

    // SMS Gateway Engine
    BREVO_API_KEY: z.string().optional(),
    SMS_SENDER: z.string().default("ArcID"),

    // Webhooks Outbox Key Signature
    WEBHOOK_SIGNING_SECRET: z
      .string()
      .min(1, "WEBHOOK_SIGNING_SECRET is required"),

    // Billing Gateway
    STRIPE_SECRET_KEY: z.string().default("sk_test_12345"),
    STRIPE_WEBHOOK_SECRET: z.string().default("whsec_12345"),

    // Key Management Service (KMS) Infrastructure Secrets
    KMS_PROVIDER: z.enum(["AWS", "GCP", ""]).optional().default(""),
    AWS_KMS_KEY_ID: z.string().optional(),
    GCP_KMS_KEY_NAME: z.string().optional(),
    LOCAL_KMS_KEY: z.string().optional(),

    // Cookie && RSA Keys
    COOKIE_SECRET: z
      .string()
      .min(32, "COOKIE_SECRET must be at least 32 characters"),
    PRIVATE_KEY_PEM: z.string().default("./certs/private.pem"),
    PUBLIC_KEY_PEM: z.string().default("./certs/public.pem"),
  })
  .superRefine((data, ctx) => {
    if (data.KMS_PROVIDER === "AWS" && !data.AWS_KMS_KEY_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AWS_KMS_KEY_ID required when provider is AWS",
        path: ["AWS_KMS_KEY_ID"],
      });
    }
    if (data.KMS_PROVIDER === "GCP" && !data.GCP_KMS_KEY_NAME) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GCP_KMS_KEY_NAME required when provider is GCP",
        path: ["GCP_KMS_KEY_NAME"],
      });
    }
    if (!data.KMS_PROVIDER && !data.LOCAL_KMS_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "LOCAL_KMS_KEY required when no KMS provider is set",
        path: ["LOCAL_KMS_KEY"],
      });
    }
  });

export const rawEnv = envSchema.parse(process.env);
