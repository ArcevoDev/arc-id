-- Add API key management tables for machine-to-machine authentication
-- Keys are stored as SHA-256 hashes only; plaintext is never persisted

-- AlterEnum: add audit log actions for API key management
ALTER TYPE "AuditLogAction" ADD VALUE 'API_KEY_CREATED';
ALTER TYPE "AuditLogAction" ADD VALUE 'API_KEY_REVOKED';

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "identityId" TEXT,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint on keyHash prevents duplicate keys
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey" ("keyHash");
CREATE INDEX "ApiKey_tenantId_idx" ON "ApiKey" ("tenantId");
CREATE INDEX "ApiKey_identityId_idx" ON "ApiKey" ("identityId");
