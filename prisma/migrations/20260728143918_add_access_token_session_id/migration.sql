-- AlterTable
ALTER TABLE "AccessToken" ADD COLUMN     "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "AccessToken_sessionId_idx" ON "AccessToken"("sessionId");
