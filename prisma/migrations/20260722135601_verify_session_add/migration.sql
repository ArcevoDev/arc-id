-- CreateEnum
CREATE TYPE "VerifySessionStatus" AS ENUM ('PENDING', 'CONSUMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "VerifySession" (
    "id" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "credentialRef" TEXT,
    "identityId" TEXT,
    "status" "VerifySessionStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerifySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerifySession_expiresAt_idx" ON "VerifySession"("expiresAt");

-- CreateIndex
CREATE INDEX "VerifySession_status_idx" ON "VerifySession"("status");
