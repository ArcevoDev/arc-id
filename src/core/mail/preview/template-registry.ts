import * as React from "react";
import { toTemplateTree } from "@arcevo/facet-emails";
import type { EmailPreviewTemplate } from "@arcevo/facet-emails/server";
import { Server } from "node:http";
import { startEmailPreviewServer, stopEmailPreviewServer } from "@arcevo/facet-emails/server";
import { ARCID_EMAIL_BRAND } from "../brand";

// ── Import every template
import { VerifyEmailMail, MagicLinkMail, PasswordResetMail, PasswordChangedMail, CredentialIssuedMail, AccountSuspendedMail, AccountDeletionMail, MfaCodeMail, MfaDisabledAlertMail, TenantInviteMail, WelcomeMail, RecoveryCodesIssuedMail, NewDeviceLoginMail  } from "../templates";

// ── Sample data used only for preview rendering ───────────────────────────────
const BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

/**
 * Registry of every email template, mapped to a preview-friendly representation
 * that the facet-emails dev server understands.
 *
 * Each `tree` is wrapped in `toTemplateTree()` so React templates are
 * converted to framework-agnostic TemplateNode trees — the same format the
 * preview server uses to render both HTML and plaintext.
 */
export const TEMPLATE_REGISTRY: Record<string, EmailPreviewTemplate> = {
  "verify-email": {
    title: "Verify Email Address",
    tree: () =>
      toTemplateTree(
        React.createElement(VerifyEmailMail, {
          verifyUrl: `${BASE}/auth/email/verify?token=preview_token_abc123`,
          name: "Alex",
        }),
      ),
  },

  "magic-link": {
    title: "Magic Link Sign-In",
    tree: () =>
      toTemplateTree(
        React.createElement(MagicLinkMail, {
          loginUrl: `${BASE}/auth/magic-link?token=preview_token_abc123`,
          name: "Alex",
          ip: "102.89.3.1",
        }),
      ),
  },

  "password-reset": {
    title: "Password Reset",
    tree: () =>
      toTemplateTree(
        React.createElement(PasswordResetMail, {
          resetUrl: `${BASE}/auth/password/reset/confirm?token=preview_token_abc123`,
          name: "Alex",
          ip: "102.89.3.1",
        }),
      ),
  },

  "password-changed": {
    title: "Password Changed",
    tree: () =>
      toTemplateTree(
        React.createElement(PasswordChangedMail, {
          name: "Alex",
          ip: "102.89.3.1",
          changedAt: new Date().toISOString(),
        }),
      ),
  },

  welcome: {
    title: "Welcome to ArcID",
    tree: () =>
      toTemplateTree(
        React.createElement(WelcomeMail, {
          name: "Alex",
          dashboardUrl: "http://localhost:3000/dashboard",
        }),
      ),
  },

  "mfa-code": {
    title: "MFA Verification Code",
    tree: () =>
      toTemplateTree(
        React.createElement(MfaCodeMail, {
          code: "847 291",
          name: "Alex",
          ttlSec: 600,
        }),
      ),
  },

  "recovery-codes": {
    title: "Recovery Codes Issued",
    tree: () =>
      toTemplateTree(
        React.createElement(RecoveryCodesIssuedMail, {
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
      ),
  },

  "mfa-disabled": {
    title: "MFA Disabled Alert",
    tree: () =>
      toTemplateTree(
        React.createElement(MfaDisabledAlertMail, {
          name: "Alex",
          ip: "102.89.3.1",
          resetUrl: `${BASE}/auth/password/reset`,
          changedAt: new Date().toISOString(),
        }),
      ),
  },

  "new-device-login": {
    title: "New Device Login",
    tree: () =>
      toTemplateTree(
        React.createElement(NewDeviceLoginMail, {
          name: "Alex",
          ip: "102.89.3.1",
          userAgent: "Chrome 124 / macOS Sonoma",
          loginAt: new Date().toISOString(),
          revokeUrl: "http://localhost:3000/settings/sessions",
        }),
      ),
  },

  "account-suspended": {
    title: "Account Suspended",
    tree: () =>
      toTemplateTree(
        React.createElement(AccountSuspendedMail, {
          name: "Alex",
          reason: "Violation of terms of service - section 4.2",
        }),
      ),
  },

  "tenant-invite": {
    title: "Tenant Invitation",
    tree: () =>
      toTemplateTree(
        React.createElement(TenantInviteMail, {
          inviteeEmail: "alex@example.com",
          tenantName: "Arcevo Health",
          inviterName: "Dr. Morgan",
          role: "MEMBER",
          acceptUrl:
            "http://localhost:3000/invites/accept?token=preview_invite_token",
          expiresAt: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }),
      ),
  },

  "credential-issued": {
    title: "Credential Issued",
    tree: () =>
      toTemplateTree(
        React.createElement(CredentialIssuedMail, {
          holderName: "Alex",
          credentialType: "UniversityDegreeCredential",
          issuerName: "Arcevo University",
          credentialId:
            "urn:uuid:3a8e1c92-4d7f-4b2e-9f1a-0c8d3e5f7b9c",
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(
            Date.now() + 365 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          walletUrl: "http://localhost:3000/credentials",
        }),
      ),
  },

  "account-deletion": {
    title: "Account Deletion Scheduled",
    tree: () =>
      toTemplateTree(
        React.createElement(AccountDeletionMail, {
          name: "Alex",
          deletedAt: new Date().toISOString(),
          graceDays: 30,
        }),
      ),
  },
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATE_REGISTRY);

/** Singleton handle for the preview server (dev-only). */
let previewServer: Server | null = null;

/** Start the facet-emails preview server. No-op in production. */
export async function startMailPreviewServer(): Promise<Server | null> {
  if (process.env.NODE_ENV === "production" || previewServer) return previewServer;

  previewServer = startEmailPreviewServer({
    templates: TEMPLATE_REGISTRY,
    brand: ARCID_EMAIL_BRAND,
    port: 3888,
    host: "127.0.0.1",
    onReady: (port: number) => {
      // eslint-disable-next-line no-console
      console.log(
        `[mail] preview server ready → http://127.0.0.1:${port} (${TEMPLATE_NAMES.length} templates)`,
      );
    },
  });

  return previewServer;
}

/** Stop the preview server if it is running. */
export async function stopMailPreviewServer(): Promise<void> {
  if (!previewServer) return;
  await stopEmailPreviewServer(previewServer);
  previewServer = null;
}
