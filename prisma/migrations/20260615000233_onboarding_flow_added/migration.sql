-- CreateTable
CREATE TABLE "OnboardingFlow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "completedSteps" JSONB NOT NULL DEFAULT '[]',
    "data" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingFlow_projectId_idx" ON "OnboardingFlow"("projectId");

-- CreateIndex
CREATE INDEX "OnboardingProgress_identityId_idx" ON "OnboardingProgress"("identityId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingProgress_identityId_flowId_key" ON "OnboardingProgress"("identityId", "flowId");

-- AddForeignKey
ALTER TABLE "OnboardingFlow" ADD CONSTRAINT "OnboardingFlow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "OnboardingFlow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
