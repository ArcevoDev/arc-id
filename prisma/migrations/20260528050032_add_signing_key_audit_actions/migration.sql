-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditLogAction" ADD VALUE 'SIGNING_KEY_CREATED';
ALTER TYPE "AuditLogAction" ADD VALUE 'SIGNING_KEY_REVOKED';
ALTER TYPE "AuditLogAction" ADD VALUE 'PASSKEY_REGISTERED';
ALTER TYPE "AuditLogAction" ADD VALUE 'PASSKEY_USED';
