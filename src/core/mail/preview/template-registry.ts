import * as React from "react";

// ── Import every template
import { VerifyEmailMail } from "../templates/VerifyEmailMail";
import { MagicLinkMail } from "../templates/MagicLinkMail";
import { PasswordResetMail } from "../templates/PasswordResetMail";
import { PasswordChangedMail } from "../templates/PasswordChangedMail";
import { WelcomeMail } from "../templates/WelcomeMail";
import { MfaCodeMail } from "../templates/MfaCodeMail";
import { RecoveryCodesIssuedMail } from "../templates/RecoveryCodesIssuedMail";
import { MfaDisabledAlertMail } from "../templates/MfaDisabledAlertMail";
import { NewDeviceLoginMail } from "../templates/NewDeviceLoginMail";
import { AccountSuspendedMail } from "../templates/AccountSuspendedMail";
import { TenantInviteMail } from "../templates/TenantInviteMail";
import { CredentialIssuedMail } from "../templates/CredentialIssuedMail";
import { AccountDeletionMail } from "../templates/AccountDeletionMail";

// ── Sample data used only for preview rendering ───────────────────────────────
const BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

export const TEMPLATE_REGISTRY: Record<string, React.ReactElement> = {
  "verify-email": React.createElement(VerifyEmailMail, {
    verifyUrl: `${BASE}/auth/email/verify?token=preview_token_abc123`,
    name: "Alex",
  }),
  "magic-link": React.createElement(MagicLinkMail, {
    loginUrl: `${BASE}/auth/magic-link?token=preview_token_abc123`,
    name: "Alex",
    ip: "102.89.3.1",
  }),
  "password-reset": React.createElement(PasswordResetMail, {
    resetUrl: `${BASE}/auth/password/reset/confirm?token=preview_token_abc123`,
    name: "Alex",
    ip: "102.89.3.1",
  }),
  "password-changed": React.createElement(PasswordChangedMail, {
    name: "Alex",
    ip: "102.89.3.1",
    changedAt: new Date().toISOString(),
  }),
  welcome: React.createElement(WelcomeMail, {
    name: "Alex",
    dashboardUrl: "http://localhost:3000/dashboard",
  }),
  "mfa-code": React.createElement(MfaCodeMail, {
    code: "847 291",
    name: "Alex",
    ttlSec: 600,
  }),
  "recovery-codes": React.createElement(RecoveryCodesIssuedMail, {
    name: "Alex",
    codes: [
      "XKCD-7F2A-M9PQ",
      "B3TH-92WE-RNVA",
      "PLMK-4X1C-7YDS",
      "QRST-8J6N-WCDE",
      "MNBV-3K9P-XFGT",
      "HIJK-5T2Y-OLPQ",
      "ASDF-1R7U-NWZX",
      "ZXCV-6E4I-MOLS",
      "QWER-2U8O-FGHB",
      "TYUI-9S5L-DJKM",
    ],
  }),
  "mfa-disabled": React.createElement(MfaDisabledAlertMail, {
    name: "Alex",
    ip: "102.89.3.1",
    resetUrl: `${BASE}/auth/password/reset`,
    changedAt: new Date().toISOString(),
  }),
  "new-device-login": React.createElement(NewDeviceLoginMail, {
    name: "Alex",
    ip: "102.89.3.1",
    userAgent: "Chrome 124 / macOS Sonoma",
    loginAt: new Date().toISOString(),
    revokeUrl: "http://localhost:3000/settings/sessions",
  }),
  "account-suspended": React.createElement(AccountSuspendedMail, {
    name: "Alex",
    reason: "Violation of terms of service — section 4.2",
  }),
  "tenant-invite": React.createElement(TenantInviteMail, {
    inviteeEmail: "alex@example.com",
    tenantName: "Arcevo Health",
    inviterName: "Dr. Morgan",
    role: "MEMBER",
    acceptUrl:
      "http://localhost:3000/invites/accept?token=preview_invite_token",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }),
  "credential-issued": React.createElement(CredentialIssuedMail, {
    holderName: "Alex",
    credentialType: "UniversityDegreeCredential",
    issuerName: "Arcevo University",
    credentialId: "urn:uuid:3a8e1c92-4d7f-4b2e-9f1a-0c8d3e5f7b9c",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    walletUrl: "http://localhost:3000/credentials",
  }),
  "account-deletion": React.createElement(AccountDeletionMail, {
    name: "Alex",
    deletedAt: new Date().toISOString(),
    graceDays: 30,
  }),
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATE_REGISTRY);
