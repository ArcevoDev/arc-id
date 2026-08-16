/*
  Warnings:

  - You are about to drop the column `externalCustomerId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `externalSubId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `identityId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `Subscription` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[identityId,clientId]` on the table `OAuthConsent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditLogAction" ADD VALUE 'MFA_VERIFICATION_SUCCESS';
ALTER TYPE "AuditLogAction" ADD VALUE 'MFA_VERIFICATION_FAILED';

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_identityId_fkey";

-- DropIndex
DROP INDEX "OAuthConsent_identityId_clientId_idx";

-- DropIndex
DROP INDEX "Subscription_identityId_idx";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "externalCustomerId",
DROP COLUMN "externalSubId",
DROP COLUMN "identityId",
DROP COLUMN "provider",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "tenantId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "ExternalBillingIntegration" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "externalCustomerId" TEXT,
    "externalSubId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalBillingIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalBillingIntegration_subscriptionId_idx" ON "ExternalBillingIntegration"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalBillingIntegration_providerName_externalSubId_key" ON "ExternalBillingIntegration"("providerName", "externalSubId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthConsent_identityId_clientId_key" ON "OAuthConsent"("identityId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalBillingIntegration" ADD CONSTRAINT "ExternalBillingIntegration_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
