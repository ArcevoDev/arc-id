-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "category" TEXT;

-- CreateIndex
CREATE INDEX "Client_projectId_idx" ON "Client"("projectId");

-- CreateIndex
CREATE INDEX "Project_category_idx" ON "Project"("category");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
