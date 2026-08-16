/*
  Warnings:

  - Added the required column `expiresAt` to the `RevokedJti` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RevokedJti" ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "RevokedJti_expiresAt_idx" ON "RevokedJti"("expiresAt");
