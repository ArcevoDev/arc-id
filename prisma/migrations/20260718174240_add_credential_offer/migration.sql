-- CreateEnum
CREATE TYPE "CredentialOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditLogAction" ADD VALUE 'EXTERNAL_IDENTIFIER_LINKED';
ALTER TYPE "AuditLogAction" ADD VALUE 'EXTERNAL_IDENTIFIER_UNLINKED';

-- CreateTable
CREATE TABLE "CredentialOffer" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "issuerDid" TEXT NOT NULL,
    "subjectDid" TEXT NOT NULL,
    "holderId" TEXT,
    "format" "VcFormat" NOT NULL DEFAULT 'JWT',
    "credentialSubject" JSONB NOT NULL,
    "schemaId" TEXT,
    "credentialExpiresAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "CredentialOfferStatus" NOT NULL DEFAULT 'PENDING',
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CredentialOffer_token_key" ON "CredentialOffer"("token");

-- CreateIndex
CREATE INDEX "CredentialOffer_token_idx" ON "CredentialOffer"("token");

-- CreateIndex
CREATE INDEX "CredentialOffer_expiresAt_idx" ON "CredentialOffer"("expiresAt");

-- CreateIndex
CREATE INDEX "CredentialOffer_status_idx" ON "CredentialOffer"("status");
