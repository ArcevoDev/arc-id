/*
  Warnings:

  - A unique constraint covering the columns `[clientId,uri]` on the table `ClientRedirectUri` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[identityId,type]` on the table `Mfa` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId]` on the table `TenantPolicy` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `TenantPolicy` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditLogAction" ADD VALUE 'IDENTITY_CREATED';
ALTER TYPE "AuditLogAction" ADD VALUE 'IDENTITY_SUSPENDED';
ALTER TYPE "AuditLogAction" ADD VALUE 'IDENTITY_DELETED';

-- DropIndex
DROP INDEX "ClientRedirectUri_uri_key";

-- DropIndex
DROP INDEX "TenantPolicy_tenantId_idx";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "logoUri" TEXT,
ADD COLUMN     "policyUri" TEXT,
ADD COLUMN     "tosUri" TEXT;

-- AlterTable
ALTER TABLE "LegalConsent" ADD COLUMN     "version" TEXT NOT NULL DEFAULT '1.0';

-- AlterTable
ALTER TABLE "OAuthAccount" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "refreshToken" TEXT;

-- AlterTable
ALTER TABLE "Passkey" ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "externalCustomerId" TEXT,
ADD COLUMN     "externalSubId" TEXT;

-- AlterTable
ALTER TABLE "TenantPolicy" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "eventType" "AuditLogAction" NOT NULL,
    "identityId" TEXT,
    "tenantId" TEXT,
    "payload" JSONB NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookEvent_deliveredAt_nextRetryAt_idx" ON "WebhookEvent"("deliveredAt", "nextRetryAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_identityId_idx" ON "WebhookEvent"("identityId");

-- CreateIndex
CREATE INDEX "AuditLog_actionId_idx" ON "AuditLog"("actionId");

-- CreateIndex
CREATE INDEX "AuthorizationCode_identityId_idx" ON "AuthorizationCode"("identityId");

-- CreateIndex
CREATE INDEX "AuthorizationCode_expiresAt_idx" ON "AuthorizationCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientRedirectUri_clientId_uri_key" ON "ClientRedirectUri"("clientId", "uri");

-- CreateIndex
CREATE INDEX "Device_identityId_idx" ON "Device"("identityId");

-- CreateIndex
CREATE INDEX "EmailToken_identityId_type_idx" ON "EmailToken"("identityId", "type");

-- CreateIndex
CREATE INDEX "EmailToken_expiresAt_idx" ON "EmailToken"("expiresAt");

-- CreateIndex
CREATE INDEX "ExternalIdentifier_identityId_idx" ON "ExternalIdentifier"("identityId");

-- CreateIndex
CREATE INDEX "Identity_status_idx" ON "Identity"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Mfa_identityId_type_key" ON "Mfa"("identityId", "type");

-- CreateIndex
CREATE INDEX "OAuthAccount_identityId_idx" ON "OAuthAccount"("identityId");

-- CreateIndex
CREATE INDEX "OAuthConsent_identityId_clientId_idx" ON "OAuthConsent"("identityId", "clientId");

-- CreateIndex
CREATE INDEX "Session_valid_idx" ON "Session"("valid");

-- CreateIndex
CREATE INDEX "Subscription_identityId_idx" ON "Subscription"("identityId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantPolicy_tenantId_key" ON "TenantPolicy"("tenantId");

-- CreateIndex
CREATE INDEX "TenantSigningKey_isActive_idx" ON "TenantSigningKey"("isActive");

-- CreateIndex
CREATE INDEX "Wallet_identityId_idx" ON "Wallet"("identityId");
