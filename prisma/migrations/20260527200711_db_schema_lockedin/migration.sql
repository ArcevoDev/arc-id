-- CreateEnum
CREATE TYPE "MfaType" AS ENUM ('TOTP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER', 'GUEST', 'MEMBER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'VERIFIED', 'SUSPENDED', 'BANNED', 'DELETED', 'PENDING');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD', 'MAGIC_LINK');

-- CreateEnum
CREATE TYPE "KeyType" AS ENUM ('Ed25519VerificationKey2020', 'X25519KeyAgreementKey2020', 'JsonWebKey2020', 'Multikey');

-- CreateEnum
CREATE TYPE "StatusPurpose" AS ENUM ('REVOCATION', 'SUSPENSION');

-- CreateEnum
CREATE TYPE "VcFormat" AS ENUM ('JWT', 'SD_JWT', 'JSON_LD', 'DataIntegrity');

-- CreateEnum
CREATE TYPE "AuditLogAction" AS ENUM ('USER_LOGIN_SUCCESS', 'USER_LOGIN_FAILED', 'USER_REGISTERED', 'PASSWORD_CHANGED', 'MFA_ENABLED', 'MFA_DISABLED', 'MFA_RECOVERY_USED', 'TOKEN_REVOKED', 'SESSION_CREATED', 'SESSION_REVOKED', 'CREDENTIAL_ISSUED', 'CREDENTIAL_REVOKED', 'OAUTH_CONSENT_GRANTED', 'OAUTH_CONSENT_REVOKED', 'TENANT_MEMBER_ADDED', 'TENANT_MEMBER_REMOVED');

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "primaryEmail" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "picture" TEXT,
    "globalRole" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecentralizedIdentifier" (
    "id" TEXT NOT NULL,
    "identityId" TEXT,
    "tenantId" TEXT,
    "publicKeyBytes" BYTEA NOT NULL,
    "keyType" "KeyType" NOT NULL,
    "didDocument" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecentralizedIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifiableCredential" (
    "id" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "type" JSONB NOT NULL,
    "format" "VcFormat" NOT NULL DEFAULT 'JWT',
    "issuerDid" TEXT NOT NULL,
    "subjectDid" TEXT NOT NULL,
    "holderId" TEXT,
    "credentialSubject" JSONB NOT NULL,
    "proof" JSONB,
    "statusListIndex" INTEGER,
    "statusListId" TEXT,
    "schemaId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifiableCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialSchema" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'JsonSchema',
    "jsonSchema" JSONB NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialSchema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BitstringStatusList" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BitstringStatusListEntry',
    "statusPurpose" "StatusPurpose" NOT NULL,
    "encodedList" BYTEA NOT NULL,
    "maxSize" INTEGER NOT NULL DEFAULT 131072,
    "issuedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BitstringStatusList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusListEntry" (
    "id" TEXT NOT NULL,
    "statusListId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sector" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSigningKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "privateKey" BYTEA NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "algorithm" TEXT NOT NULL,
    "kmsProvider" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "TenantSigningKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMembership" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantRole" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "profile" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requireMfa" BOOLEAN NOT NULL DEFAULT false,
    "passwordRules" JSONB,
    "loginMethods" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalAccount" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordAlgorithm" TEXT NOT NULL DEFAULT 'argon2id',
    "passwordUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "deviceType" TEXT NOT NULL,
    "transports" JSONB,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mfa" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "type" "MfaType" NOT NULL,
    "secret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mfa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaRecoveryCode" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT,
    "grantTypes" JSONB NOT NULL,
    "scopes" JSONB NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "requirePkce" BOOLEAN NOT NULL DEFAULT false,
    "frontChannelLogoutUri" TEXT,
    "backChannelLogoutUri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRedirectUri" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientRedirectUri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "redirectUri" TEXT,
    "scopes" JSONB NOT NULL,
    "nonce" TEXT,
    "codeChallenge" TEXT,
    "codeChallengeMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "audience" JSONB,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "jti" TEXT,

    CONSTRAINT "AccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "sessionId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "rotation" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdToken" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "claims" JSONB,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessDelegation" (
    "id" TEXT NOT NULL,
    "grantorId" TEXT NOT NULL,
    "granteeId" TEXT NOT NULL,
    "tenantId" TEXT,
    "scopes" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "localAccountId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "platform" TEXT,
    "browser" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "localAccountId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "refreshTokenId" TEXT,
    "riskSignals" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "valid" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerWalletId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIdentifier" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "valueHash" TEXT NOT NULL,
    "displayValue" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthConsent" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalConsent" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailToken" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "identityId" TEXT,
    "tenantId" TEXT,
    "actionId" "AuditLogAction" NOT NULL,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevokedJti" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedJti_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Identity_primaryEmail_key" ON "Identity"("primaryEmail");

-- CreateIndex
CREATE INDEX "Identity_primaryEmail_idx" ON "Identity"("primaryEmail");

-- CreateIndex
CREATE UNIQUE INDEX "DecentralizedIdentifier_tenantId_key" ON "DecentralizedIdentifier"("tenantId");

-- CreateIndex
CREATE INDEX "DecentralizedIdentifier_identityId_idx" ON "DecentralizedIdentifier"("identityId");

-- CreateIndex
CREATE INDEX "VerifiableCredential_holderId_idx" ON "VerifiableCredential"("holderId");

-- CreateIndex
CREATE INDEX "VerifiableCredential_issuerDid_idx" ON "VerifiableCredential"("issuerDid");

-- CreateIndex
CREATE INDEX "VerifiableCredential_subjectDid_idx" ON "VerifiableCredential"("subjectDid");

-- CreateIndex
CREATE UNIQUE INDEX "StatusListEntry_statusListId_index_key" ON "StatusListEntry"("statusListId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSigningKey_kid_key" ON "TenantSigningKey"("kid");

-- CreateIndex
CREATE INDEX "TenantSigningKey_tenantId_idx" ON "TenantSigningKey"("tenantId");

-- CreateIndex
CREATE INDEX "TenantMembership_tenantId_idx" ON "TenantMembership"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMembership_identityId_tenantId_key" ON "TenantMembership"("identityId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_tenantId_idx" ON "Project"("tenantId");

-- CreateIndex
CREATE INDEX "TenantPolicy_tenantId_idx" ON "TenantPolicy"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAccount_identityId_key" ON "LocalAccount"("identityId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAccount_email_key" ON "LocalAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");

-- CreateIndex
CREATE INDEX "Passkey_identityId_idx" ON "Passkey"("identityId");

-- CreateIndex
CREATE INDEX "MfaRecoveryCode_identityId_idx" ON "MfaRecoveryCode"("identityId");

-- CreateIndex
CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_tenantId_clientId_key" ON "Client"("tenantId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientRedirectUri_uri_key" ON "ClientRedirectUri"("uri");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationCode_code_key" ON "AuthorizationCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AccessToken_token_key" ON "AccessToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AccessToken_jti_key" ON "AccessToken"("jti");

-- CreateIndex
CREATE INDEX "AccessToken_token_revoked_idx" ON "AccessToken"("token", "revoked");

-- CreateIndex
CREATE INDEX "AccessToken_identityId_clientId_idx" ON "AccessToken"("identityId", "clientId");

-- CreateIndex
CREATE INDEX "AccessToken_expiresAt_idx" ON "AccessToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_token_revoked_idx" ON "RefreshToken"("token", "revoked");

-- CreateIndex
CREATE INDEX "RefreshToken_identityId_idx" ON "RefreshToken"("identityId");

-- CreateIndex
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdToken_jti_key" ON "IdToken"("jti");

-- CreateIndex
CREATE INDEX "IdToken_identityId_idx" ON "IdToken"("identityId");

-- CreateIndex
CREATE INDEX "IdToken_expiresAt_idx" ON "IdToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Device_fingerprint_key" ON "Device"("fingerprint");

-- CreateIndex
CREATE INDEX "Session_identityId_idx" ON "Session"("identityId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerUserId_key" ON "OAuthAccount"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_provider_providerWalletId_key" ON "Wallet"("provider", "providerWalletId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentifier_type_valueHash_key" ON "ExternalIdentifier"("type", "valueHash");

-- CreateIndex
CREATE UNIQUE INDEX "LegalConsent_identityId_documentId_key" ON "LegalConsent"("identityId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailToken_token_key" ON "EmailToken"("token");

-- CreateIndex
CREATE INDEX "AuditLog_identityId_idx" ON "AuditLog"("identityId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RevokedJti_jti_key" ON "RevokedJti"("jti");

-- CreateIndex
CREATE INDEX "RevokedJti_revokedAt_idx" ON "RevokedJti"("revokedAt");

-- AddForeignKey
ALTER TABLE "DecentralizedIdentifier" ADD CONSTRAINT "DecentralizedIdentifier_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecentralizedIdentifier" ADD CONSTRAINT "DecentralizedIdentifier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiableCredential" ADD CONSTRAINT "VerifiableCredential_issuerDid_fkey" FOREIGN KEY ("issuerDid") REFERENCES "DecentralizedIdentifier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiableCredential" ADD CONSTRAINT "VerifiableCredential_subjectDid_fkey" FOREIGN KEY ("subjectDid") REFERENCES "DecentralizedIdentifier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiableCredential" ADD CONSTRAINT "VerifiableCredential_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiableCredential" ADD CONSTRAINT "VerifiableCredential_statusListId_fkey" FOREIGN KEY ("statusListId") REFERENCES "BitstringStatusList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiableCredential" ADD CONSTRAINT "VerifiableCredential_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "CredentialSchema"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusListEntry" ADD CONSTRAINT "StatusListEntry_statusListId_fkey" FOREIGN KEY ("statusListId") REFERENCES "BitstringStatusList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSigningKey" ADD CONSTRAINT "TenantSigningKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPolicy" ADD CONSTRAINT "TenantPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalAccount" ADD CONSTRAINT "LocalAccount_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mfa" ADD CONSTRAINT "Mfa_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRedirectUri" ADD CONSTRAINT "ClientRedirectUri_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationCode" ADD CONSTRAINT "AuthorizationCode_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationCode" ADD CONSTRAINT "AuthorizationCode_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdToken" ADD CONSTRAINT "IdToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdToken" ADD CONSTRAINT "IdToken_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessDelegation" ADD CONSTRAINT "AccessDelegation_grantorId_fkey" FOREIGN KEY ("grantorId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessDelegation" ADD CONSTRAINT "AccessDelegation_granteeId_fkey" FOREIGN KEY ("granteeId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessDelegation" ADD CONSTRAINT "AccessDelegation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_localAccountId_fkey" FOREIGN KEY ("localAccountId") REFERENCES "LocalAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_localAccountId_fkey" FOREIGN KEY ("localAccountId") REFERENCES "LocalAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIdentifier" ADD CONSTRAINT "ExternalIdentifier_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConsent" ADD CONSTRAINT "OAuthConsent_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConsent" ADD CONSTRAINT "OAuthConsent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalConsent" ADD CONSTRAINT "LegalConsent_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailToken" ADD CONSTRAINT "EmailToken_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
