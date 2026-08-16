/*
  Warnings:

  - Added the required column `updatedAt` to the `OAuthConsent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "AuditLogAction" ADD VALUE 'TENANT_POLICY_UPDATED';

-- AlterTable
ALTER TABLE "OAuthConsent" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "provider" TEXT;

-- AlterTable
ALTER TABLE "TenantPolicy" ADD COLUMN     "allowPasskeys" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowedEmailDomains" TEXT[],
ADD COLUMN     "maxSessionsPerUser" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "sessionTtlMinutes" INTEGER NOT NULL DEFAULT 10080,
ALTER COLUMN "loginMethods" SET DEFAULT '{}';
