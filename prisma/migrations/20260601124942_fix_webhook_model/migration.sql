-- DropIndex
DROP INDEX "WebhookEvent_deliveredAt_nextRetryAt_idx";

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "nextRetryAt" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "idx_webhook_processing" ON "WebhookEvent"("nextRetryAt") WHERE ("deliveredAt" IS NULL);
