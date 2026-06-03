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
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_ISSUER: z.string().default("arcid"),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("7d"),

    // Passkey / WebAuthn Options
    WEBAUTHN_RP_ID: z.string().default("localhost"),
    WEBAUTHN_RP_NAME: z.string().default("ArcID"),
    WEBAUTHN_ORIGIN: z.string().url().default("http://localhost:3000"),

    // Upstash Redis Token Cache Layer (optional — falls back to in-memory)
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

    // Mail Delivery Communication Vector
    RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
    EMAIL_FROM: z.string().default("ArcID <noreply@arcevocirqle.com.ng>"),

    // SMS Gateway — SKIPPED for now (Brevo costs too much at MVP stage)
    BREVO_API_KEY: z.string().optional(),
    SMS_SENDER: z.string().default("ArcID"),

    // Webhooks Outbox Key Signature
    WEBHOOK_SIGNING_SECRET: z
      .string()
      .min(1, "WEBHOOK_SIGNING_SECRET is required"),

    // ── Billing Gateways ────────────────────────────────────────────────────
    // Stripe (global)
    STRIPE_SECRET_KEY: z.string().default(""),
    STRIPE_WEBHOOK_SECRET: z.string().default(""),
    // Paystack (Nigeria / Africa)
    PAYSTACK_SECRET_KEY: z.string().default(""),
    PAYSTACK_WEBHOOK_SECRET: z.string().default(""),
    // Flutterwave (Africa)
    FLUTTERWAVE_SECRET_KEY: z.string().default(""),
    FLUTTERWAVE_SECRET_HASH: z.string().default(""),

    // Key Management Service (KMS) Infrastructure Secrets
    KMS_PROVIDER: z.enum(["AWS", "GCP", ""]).optional().default(""),
    AWS_KMS_KEY_ID: z.string().optional(),
    GCP_KMS_KEY_NAME: z.string().optional(),
    LOCAL_KMS_KEY: z.string().optional(),

    // Cookie Secret
    COOKIE_SECRET: z
      .string()
      .min(32, "COOKIE_SECRET must be at least 32 characters"),

    // ── RSA/EC Key Pair for RS256 token signing (optional) ─────────────────
    PRIVATE_KEY_PEM: z.string().default(""),
    PUBLIC_KEY_PEM: z.string().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.KMS_PROVIDER === "AWS" && !data.AWS_KMS_KEY_ID) {
      ctx.addIssue({
        code: "custom",
        message: "AWS_KMS_KEY_ID required when KMS_PROVIDER is AWS",
        path: ["AWS_KMS_KEY_ID"],
      });
    }
    if (data.KMS_PROVIDER === "GCP" && !data.GCP_KMS_KEY_NAME) {
      ctx.addIssue({
        code: "custom",
        message: "GCP_KMS_KEY_NAME required when KMS_PROVIDER is GCP",
        path: ["GCP_KMS_KEY_NAME"],
      });
    }
    if (
      !data.KMS_PROVIDER &&
      !data.LOCAL_KMS_KEY &&
      data.NODE_ENV === "production"
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "LOCAL_KMS_KEY is required in production when no KMS_PROVIDER is set",
        path: ["LOCAL_KMS_KEY"],
      });
    }
  });

export const rawEnv = envSchema.parse(process.env);
