import { Resend } from "resend";
import { config } from "@/core/config";
import { logger } from "@/lib/logger";
import { compileMailTemplate } from "@/core/mail/mail.engine";

// ── Templates ─────────────────────────────────────────────────────────────────
import { VerifyEmailMail } from "@/core/mail/templates/VerifyEmailMail";
import { MagicLinkMail } from "@/core/mail/templates/MagicLinkMail";
import { PasswordResetMail } from "@/core/mail/templates/PasswordResetMail";
import { PasswordChangedMail } from "@/core/mail/templates/PasswordChangedMail";
import { WelcomeMail } from "@/core/mail/templates/WelcomeMail";
import { MfaCodeMail } from "@/core/mail/templates/MfaCodeMail";
import { RecoveryCodesIssuedMail } from "@/core/mail/templates/RecoveryCodesIssuedMail";
import { MfaDisabledAlertMail } from "@/core/mail/templates/MfaDisabledAlertMail";
import { NewDeviceLoginMail } from "@/core/mail/templates/NewDeviceLoginMail";
import { AccountSuspendedMail } from "@/core/mail/templates/AccountSuspendedMail";
import { TenantInviteMail } from "@/core/mail/templates/TenantInviteMail";
import { CredentialIssuedMail } from "@/core/mail/templates/CredentialIssuedMail";
import { AccountDeletionMail } from "@/core/mail/templates/AccountDeletionMail";

import * as React from "react";

// ── Transport ─────────────────────────────────────────────────────────────────

const resend = new Resend(config.mail.apiKey);

async function sendEmail(
  to: string,
  subject: string,
  element: React.ReactElement,
): Promise<void> {
  try {
    const html = await compileMailTemplate(element);
    await resend.emails.send({ from: config.mail.from, to, subject, html });
    logger.info("[MAIL] Sent", { to, subject });
  } catch (err) {
    logger.error("[MAIL] Failed to send", { err, to, subject });
    // Do not throw — mail failures must never crash auth flows
  }
}

// ── SMS (Brevo) ───────────────────────────────────────────────────────────────

async function sendSms(phone: string, content: string): Promise<void> {
  if (!config.sms.apiKey) {
    logger.warn("[SMS] BREVO_API_KEY not configured — SMS skipped", { phone });
    return;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: {
        "api-key": config.sms.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: config.sms.sender,
        recipient: phone,
        content,
      }),
    });
    if (!res.ok) throw new Error(`Brevo HTTP ${res.status}`);
    logger.info("[SMS] Sent", { phone });
  } catch (err) {
    logger.error("[SMS] Failed to send", { err, phone });
  }
}

// ── Public notification API ───────────────────────────────────────────────────

export const notificationService = {
  // ── Auth emails ─────────────────────────────────────────────────────────────

  async sendEmailVerification(to: string, token: string, name?: string) {
    const url = `${config.base.apiUrl}/auth/email/verify?token=${token}`;
    await sendEmail(
      to,
      "Verify your email — ArcID",
      React.createElement(VerifyEmailMail, { verifyUrl: url, name }),
    );
  },

  async sendMagicLink(
    to: string,
    token: string,
    opts?: { name?: string; ip?: string },
  ) {
    const url = `${config.base.apiUrl}/auth/magic-link?token=${token}`;
    await sendEmail(
      to,
      "Your sign-in link — ArcID",
      React.createElement(MagicLinkMail, {
        loginUrl: url,
        name: opts?.name,
        ip: opts?.ip,
      }),
    );
  },

  async sendPasswordReset(
    to: string,
    token: string,
    opts?: { name?: string; ip?: string },
  ) {
    const url = `${config.base.apiUrl}/auth/password/reset/confirm?token=${token}`;
    await sendEmail(
      to,
      "Reset your password — ArcID",
      React.createElement(PasswordResetMail, {
        resetUrl: url,
        name: opts?.name,
        ip: opts?.ip,
      }),
    );
  },

  async sendPasswordChanged(to: string, opts?: { name?: string; ip?: string }) {
    await sendEmail(
      to,
      "Your password was changed — ArcID",
      React.createElement(PasswordChangedMail, {
        name: opts?.name,
        ip: opts?.ip,
        changedAt: new Date().toISOString(),
      }),
    );
  },

  async sendWelcome(to: string, opts?: { name?: string }) {
    const dashboardUrl = `${config.base.apiUrl.replace(":4000", ":3000")}/dashboard`;
    await sendEmail(
      to,
      "Welcome to ArcID",
      React.createElement(WelcomeMail, { name: opts?.name, dashboardUrl }),
    );
  },

  // ── MFA / Security emails ────────────────────────────────────────────────────

  async sendMfaCode(
    to: string,
    code: string,
    opts?: { name?: string; ttlSec?: number },
  ) {
    await sendEmail(
      to,
      `${code} — Your ArcID verification code`,
      React.createElement(MfaCodeMail, {
        code,
        name: opts?.name,
        ttlSec: opts?.ttlSec,
      }),
    );
  },

  async sendRecoveryCodes(to: string, codes: string[], name?: string) {
    await sendEmail(
      to,
      "Your ArcID recovery codes — save these now",
      React.createElement(RecoveryCodesIssuedMail, { codes, name }),
    );
  },

  async sendMfaDisabledAlert(to: string, opts: { name?: string; ip?: string }) {
    const resetUrl = `${config.base.apiUrl}/auth/password/reset`;
    await sendEmail(
      to,
      "⚠️ MFA was disabled on your ArcID account",
      React.createElement(MfaDisabledAlertMail, {
        name: opts.name,
        ip: opts.ip,
        resetUrl,
        changedAt: new Date().toISOString(),
      }),
    );
  },

  async sendNewDeviceLogin(
    to: string,
    opts: { name?: string; ip: string; userAgent: string },
  ) {
    const revokeUrl = `${config.base.apiUrl.replace(":4000", ":3000")}/settings/sessions`;
    await sendEmail(
      to,
      "New sign-in detected on your ArcID account",
      React.createElement(NewDeviceLoginMail, {
        name: opts.name,
        ip: opts.ip,
        userAgent: opts.userAgent,
        loginAt: new Date().toISOString(),
        revokeUrl,
      }),
    );
  },

  // ── Account lifecycle ────────────────────────────────────────────────────────

  async sendAccountSuspended(
    to: string,
    opts?: { name?: string; reason?: string },
  ) {
    await sendEmail(
      to,
      "Your ArcID account has been suspended",
      React.createElement(AccountSuspendedMail, {
        name: opts?.name,
        reason: opts?.reason,
      }),
    );
  },

  async sendAccountDeletion(
    to: string,
    opts?: { name?: string; graceDays?: number },
  ) {
    await sendEmail(
      to,
      "Your ArcID account deletion has been processed",
      React.createElement(AccountDeletionMail, {
        name: opts?.name,
        deletedAt: new Date().toISOString(),
        graceDays: opts?.graceDays,
      }),
    );
  },

  // ── Tenant ────────────────────────────────────────────────────────────────────

  async sendTenantInvite(
    to: string,
    opts: {
      tenantName: string;
      inviterName: string;
      role: string;
      inviteToken: string;
      expiresAt: string;
    },
  ) {
    const acceptUrl = `${config.base.apiUrl.replace(":4000", ":3000")}/invites/accept?token=${opts.inviteToken}`;
    await sendEmail(
      to,
      `You've been invited to join ${opts.tenantName}`,
      React.createElement(TenantInviteMail, {
        inviteeEmail: to,
        tenantName: opts.tenantName,
        inviterName: opts.inviterName,
        role: opts.role,
        acceptUrl,
        expiresAt: opts.expiresAt,
      }),
    );
  },

  // ── Verifiable Credentials ────────────────────────────────────────────────────

  async sendCredentialIssued(
    to: string,
    opts: {
      holderName?: string;
      credentialType: string;
      issuerName: string;
      credentialId: string;
      expiresAt?: string;
    },
  ) {
    const walletUrl = `${config.base.apiUrl.replace(":4000", ":3000")}/credentials`;
    await sendEmail(
      to,
      `New credential issued: ${opts.credentialType}`,
      React.createElement(CredentialIssuedMail, {
        holderName: opts.holderName,
        credentialType: opts.credentialType,
        issuerName: opts.issuerName,
        credentialId: opts.credentialId,
        issuedAt: new Date().toISOString(),
        expiresAt: opts.expiresAt,
        walletUrl,
      }),
    );
  },

  // ── SMS methods ───────────────────────────────────────────────────────────────

  sendMfaCodeSms(phone: string, code: string) {
    void sendSms(
      phone,
      `Your ArcID verification code is: ${code}. Valid for 10 minutes. Do not share.`,
    );
  },

  sendSecurityAlertSms(phone: string, message: string) {
    void sendSms(phone, `ArcID Security Alert: ${message}`);
  },
};
