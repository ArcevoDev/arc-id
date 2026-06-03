// src/core/config/config.ts
import { rawEnv } from "./env.validator";

export const config = {
  base: {
    env: rawEnv.NODE_ENV,
    logLevel: rawEnv.LOG_LEVEL,
    port: rawEnv.PORT,
    apiUrl: rawEnv.API_BASE_URL,
    allowedOrigins: rawEnv.ALLOWED_ORIGINS.split(",").map((url) => url.trim()),
    isProduction: rawEnv.NODE_ENV === "production",
    isDevelopment: rawEnv.NODE_ENV === "development",
    isTest: rawEnv.NODE_ENV === "test",
  },
  db: {
    url: rawEnv.DATABASE_URL,
  },
  oauth: {
    directClientId: rawEnv.ARCID_DIRECT_CLIENT_ID,
  },
  integration: {
    arcbaseWebhookUrl: rawEnv.ARCBASE_WEBHOOK_URL,
  },
  security: {
    cookieSecret: rawEnv.COOKIE_SECRET,
    jwt: {
      privateKey: rawEnv.PRIVATE_KEY_PEM,
      publicKey: rawEnv.PUBLIC_KEY_PEM,
    },
  },
  jwt: {
    secret: rawEnv.JWT_SECRET,
    issuer: rawEnv.JWT_ISSUER,
    accessTtl: rawEnv.JWT_ACCESS_TTL,
    refreshTtl: rawEnv.JWT_REFRESH_TTL,
  },
  redis: {
    url: rawEnv.UPSTASH_REDIS_REST_URL ?? null,
    token: rawEnv.UPSTASH_REDIS_REST_TOKEN ?? null,
    enabled: Boolean(
      rawEnv.UPSTASH_REDIS_REST_URL && rawEnv.UPSTASH_REDIS_REST_TOKEN,
    ),
  },
  auth: {
    webauthn: {
      rpId: rawEnv.WEBAUTHN_RP_ID,
      rpName: rawEnv.WEBAUTHN_RP_NAME,
      origin: rawEnv.WEBAUTHN_ORIGIN,
    },
  },
  mail: {
    apiKey: rawEnv.RESEND_API_KEY,
    from: rawEnv.EMAIL_FROM,
  },
  sms: {
    // Skipped at MVP — Brevo costs not justified yet
    apiKey: rawEnv.BREVO_API_KEY ?? null,
    sender: rawEnv.SMS_SENDER,
  },
  webhooks: {
    signingSecret: rawEnv.WEBHOOK_SIGNING_SECRET,
  },
  billing: {
    // Stripe — global
    stripe: {
      secretKey: rawEnv.STRIPE_SECRET_KEY,
      webhookSecret: rawEnv.STRIPE_WEBHOOK_SECRET,
      enabled: Boolean(rawEnv.STRIPE_SECRET_KEY),
    },
    // Paystack — Nigeria / Africa (primary for local market)
    paystack: {
      secretKey: rawEnv.PAYSTACK_SECRET_KEY,
      webhookSecret: rawEnv.PAYSTACK_WEBHOOK_SECRET,
      enabled: Boolean(rawEnv.PAYSTACK_SECRET_KEY),
    },
    // Flutterwave — Africa
    flutterwave: {
      secretKey: rawEnv.FLUTTERWAVE_SECRET_KEY,
      secretHash: rawEnv.FLUTTERWAVE_SECRET_HASH,
      enabled: Boolean(rawEnv.FLUTTERWAVE_SECRET_KEY),
    },
  },
  kms: {
    provider: rawEnv.KMS_PROVIDER ?? null,
    localKey: rawEnv.LOCAL_KMS_KEY ?? null,
    awsKeyId: rawEnv.AWS_KMS_KEY_ID ?? null,
    gcpKeyName: rawEnv.GCP_KMS_KEY_NAME ?? null,
    enabled:
      Boolean(rawEnv.KMS_PROVIDER === "AWS" && rawEnv.AWS_KMS_KEY_ID) ||
      Boolean(rawEnv.KMS_PROVIDER === "GCP" && rawEnv.GCP_KMS_KEY_NAME) ||
      Boolean(!rawEnv.KMS_PROVIDER && rawEnv.LOCAL_KMS_KEY),
  },
} as const;

export type AppConfig = typeof config;
