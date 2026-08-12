/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `Identity` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Identity" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Identity_username_key" ON "Identity"("username");
