-- AlterTable
ALTER TABLE "EmailToken" ADD COLUMN     "tenantId" TEXT;

-- CreateIndex
CREATE INDEX "EmailToken_tenantId_idx" ON "EmailToken"("tenantId");
