-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditLogAction" ADD VALUE 'SESSION_REVOKED_ALL';
ALTER TYPE "AuditLogAction" ADD VALUE 'PASSKEY_REMOVED';
ALTER TYPE "AuditLogAction" ADD VALUE 'PASSWORD_RESET_REQUESTED';
ALTER TYPE "AuditLogAction" ADD VALUE 'PASSWORD_RESET_COMPLETED';
ALTER TYPE "AuditLogAction" ADD VALUE 'EMAIL_VERIFIED';
ALTER TYPE "AuditLogAction" ADD VALUE 'EMAIL_VERIFICATION_SENT';
ALTER TYPE "AuditLogAction" ADD VALUE 'TENANT_CREATED';
ALTER TYPE "AuditLogAction" ADD VALUE 'TENANT_UPDATED';
ALTER TYPE "AuditLogAction" ADD VALUE 'SUBSCRIPTION_UPGRADED';
ALTER TYPE "AuditLogAction" ADD VALUE 'SUBSCRIPTION_CANCELLED';
ALTER TYPE "AuditLogAction" ADD VALUE 'WEBHOOK_DELIVERY_FAILED';
ALTER TYPE "AuditLogAction" ADD VALUE 'WEBHOOK_DELIVERED';
ALTER TYPE "AuditLogAction" ADD VALUE 'OAUTH_CLIENT_CREATED';
ALTER TYPE "AuditLogAction" ADD VALUE 'OAUTH_CLIENT_UPDATED';
ALTER TYPE "AuditLogAction" ADD VALUE 'ROLE_CREATED';
ALTER TYPE "AuditLogAction" ADD VALUE 'ROLE_UPDATED';
ALTER TYPE "AuditLogAction" ADD VALUE 'ROLE_ASSIGNED';
