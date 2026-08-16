import * as React from "react";
import {
  MailLayout,
  MailButton,
  MailText,
  MailSecurityNotice,
  MailDivider,
  MailLinkFallback,
} from "../components";

export interface PasswordResetMailProps {
  resetUrl: string;
  name?: string;
  ip?: string;
}

export const PasswordResetMail = ({
  resetUrl,
  name,
  ip,
}: PasswordResetMailProps) => (
  <MailLayout
    previewText="Reset your ArcID password - link valid for 1 hour"
    heading="Password Reset Request"
    eyebrow="Account security"
  >
    <MailText>
      {name ? `Hello ${name},` : "Hello,"} we received a request to reset the
      password for your ArcID account. If that was you, the button below will
      take you to a secure page where you can choose a new one.
    </MailText>

    <MailButton href={resetUrl}>Reset Password</MailButton>

    <MailSecurityNotice variant="warning" ip={ip}>
      âš ï¸ This link expires in <strong>1 hour</strong>. If you didn't request a
      password reset, no action is needed - your current password remains
      unchanged and your account stays protected.
    </MailSecurityNotice>

    <MailDivider />

    <MailText variant="small">
      A few quiet notes while you're here: never reuse this password anywhere
      else, and consider a passkey - ArcID supports passwordless sign-in, so
      one day you may not need a password at all.
    </MailText>

    <MailLinkFallback href={resetUrl} />
  </MailLayout>
);

export default PasswordResetMail;
