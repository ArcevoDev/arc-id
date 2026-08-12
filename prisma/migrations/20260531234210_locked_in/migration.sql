/*
  Warnings:

  - Made the column `tenantId` on table `Role` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Role" ALTER COLUMN "tenantId" SET NOT NULL,
ALTER COLUMN "tenantId" SET DEFAULT 'SYSTEM';
