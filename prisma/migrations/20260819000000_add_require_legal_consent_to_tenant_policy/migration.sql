-- Add requireLegalConsent to TenantPolicy to gate VC issuance on LegalConsent acceptance.
-- Default: true (enforce consent for all tenants unless explicitly disabled).
ALTER TABLE "TenantPolicy" ADD COLUMN "requireLegalConsent" BOOLEAN NOT NULL DEFAULT true;
