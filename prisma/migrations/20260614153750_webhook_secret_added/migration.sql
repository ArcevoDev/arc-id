-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "secret" TEXT;

-- CreateIndex
CREATE INDEX "DecentralizedIdentifier_tenantId_idx" ON "DecentralizedIdentifier"("tenantId");
