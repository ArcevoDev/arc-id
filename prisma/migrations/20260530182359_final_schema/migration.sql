/*
  Warnings:

  - You are about to drop the column `globalRole` on the `Identity` table. All the data in the column will be lost.
  - You are about to drop the column `tenantRole` on the `TenantMembership` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `TenantSigningKey` table. All the data in the column will be lost.
  - Added the required column `roleId` to the `TenantMembership` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "KeyStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'REVOKED');

-- CreateEnum
CREATE TYPE "IdpProtocol" AS ENUM ('SAML2', 'OIDC', 'OAUTH2');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditLogAction" ADD VALUE 'IDP_CONNECTION_CREATED';
ALTER TYPE "AuditLogAction" ADD VALUE 'IDP_CONNECTION_UPDATED';

-- DropIndex
DROP INDEX "TenantSigningKey_isActive_idx";

-- AlterTable
ALTER TABLE "Identity" DROP COLUMN "globalRole";

-- AlterTable
ALTER TABLE "TenantMembership" DROP COLUMN "tenantRole",
ADD COLUMN     "roleId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TenantSigningKey" DROP COLUMN "isActive",
ADD COLUMN     "status" "KeyStatus" NOT NULL DEFAULT 'ACTIVE';

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "TenantBranding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customDomain" TEXT,
    "primaryColor" TEXT,
    "logoUrl" TEXT,
    "companyName" TEXT,
    "emailTemplates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdpConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "protocol" "IdpProtocol" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "entryPoint" TEXT,
    "issuer" TEXT,
    "cert" TEXT,
    "metadataUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdpConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantBranding_tenantId_key" ON "TenantBranding"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantBranding_customDomain_key" ON "TenantBranding"("customDomain");

-- CreateIndex
CREATE INDEX "IdpConnection_tenantId_idx" ON "IdpConnection"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_action_key" ON "Permission"("action");

-- CreateIndex
CREATE INDEX "TenantSigningKey_status_idx" ON "TenantSigningKey"("status");

-- AddForeignKey
ALTER TABLE "TenantBranding" ADD CONSTRAINT "TenantBranding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdpConnection" ADD CONSTRAINT "IdpConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
