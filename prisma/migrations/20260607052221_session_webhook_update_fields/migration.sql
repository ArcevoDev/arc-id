-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "authLevel" TEXT,
ADD COLUMN     "elevatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "processingAt" TIMESTAMP(3),
ADD COLUMN     "processingBy" TEXT;

-- CreateIndex
CREATE INDEX "WebhookEvent_processingBy_idx" ON "WebhookEvent"("processingBy");

-- CreateIndex
CREATE INDEX "WebhookEvent_processingAt_idx" ON "WebhookEvent"("processingAt");
